"""Rebuild the two UV albedos from the local reference and Hybrid donor assets."""

import argparse
import hashlib
import json
from pathlib import Path
import struct

import numpy as np
from PIL import Image, ImageFilter


def read_model(path):
    data = path.read_bytes()
    if path.suffix == ".glb":
        json_bytes = struct.unpack_from("<I", data, 12)[0]
        return json.loads(data[20:20 + json_bytes]), data[28 + json_bytes:]
    document = json.loads(data)
    return document, (path.parent / document["buffers"][0]["uri"]).read_bytes()


def read_accessor(model, index):
    document, data = model
    accessor = document["accessors"][index]
    view = document["bufferViews"][accessor["bufferView"]]
    dtype = np.dtype({5123: "<u2", 5125: "<u4", 5126: "<f4"}[accessor["componentType"]])
    width = {"SCALAR": 1, "VEC2": 2, "VEC3": 3}[accessor["type"]]
    return np.ndarray((accessor["count"], width), dtype=dtype, buffer=data,
                      offset=view.get("byteOffset", 0) + accessor.get("byteOffset", 0),
                      strides=(view.get("byteStride", dtype.itemsize * width), dtype.itemsize))


def uv_surface(model, mesh_prefix, size):
    """Rasterize the donor's bind positions (and normals) in its unchanged UVs."""
    primitive = next(mesh["primitives"][0] for mesh in model[0]["meshes"]
                     if mesh["name"].startswith(mesh_prefix))
    attributes = primitive["attributes"]
    xyz = read_accessor(model, attributes["POSITION"])
    normal = read_accessor(model, attributes["NORMAL"])
    uv = read_accessor(model, attributes["TEXCOORD_0"]) * size
    triangles = read_accessor(model, primitive["indices"]).reshape(-1, 3)
    values = np.column_stack((xyz, normal))
    surface = np.full((size, size, 6), np.nan, dtype=np.float32)
    for triangle in triangles:
        points = uv[triangle]
        xmin, ymin = np.maximum(0, np.floor(points.min(axis=0)).astype(int))
        xmax, ymax = np.minimum(size - 1, np.ceil(points.max(axis=0)).astype(int))
        if xmax < xmin or ymax < ymin:
            continue
        ab, ac = points[1:] - points[0]
        determinant = ab[0] * ac[1] - ab[1] * ac[0]
        if abs(determinant) < 1e-8:
            continue
        yy, xx = np.ogrid[ymin:ymax + 1, xmin:xmax + 1]
        dx, dy = xx - points[0, 0] + .5, yy - points[0, 1] + .5
        b = (dx * ac[1] - dy * ac[0]) / determinant
        c = (ab[0] * dy - ab[1] * dx) / determinant
        a = 1 - b - c
        inside = (a >= 0) & (b >= 0) & (c >= 0)
        surface[ymin:ymax + 1, xmin:xmax + 1][inside] = (
            a[inside, None] * values[triangle[0]] + b[inside, None] * values[triangle[1]]
            + c[inside, None] * values[triangle[2]]
        )
    return surface


def smooth(low, high, x):
    t = np.clip((x - low) / (high - low), 0, 1)
    return t * t * (3 - 2 * t)


def blend(a, b, amount):
    return a + (b - a) * amount[..., None]


def image_array(path, size):
    return np.array(Image.open(path).convert("RGB").resize((size, size), Image.Resampling.LANCZOS), dtype=np.float32)


def blurred(rgb, radius):
    return np.asarray(Image.fromarray(np.uint8(rgb)).filter(ImageFilter.GaussianBlur(radius)), dtype=np.float32)


def extend_islands(rgb, authored, valid, iterations):
    for _ in range(iterations):
        added = valid.copy()
        for axis in (0, 1):
            for shift in (-1, 1):
                adjacent = np.roll(valid, shift, axis=axis) & ~added
                authored[adjacent] = np.roll(authored, shift, axis=axis)[adjacent]
                added |= adjacent
        valid = added
    return np.where(valid[..., None], authored, rgb)


def sample_rgb(rgb, px, py):
    height, width = rgb.shape[:2]
    px = np.clip(px, 0, width - 1.001)
    py = np.clip(py, 0, height - 1.001)
    x, y = px.astype(int), py.astype(int)
    row_a = blend(rgb[y, x], rgb[y, x + 1], px - x)
    row_b = blend(rgb[y + 1, x], rgb[y + 1, x + 1], px - x)
    return blend(row_a, row_b, py - y)


def value_noise(x, y, seed):
    """Seeded surface noise with a continuous gradient between lattice cells."""
    i, j = np.floor(x), np.floor(y)
    u, v = smooth(0, 1, x - i), smooth(0, 1, y - j)

    def corner(a, b):
        value = np.sin(a * 127.1 + b * 311.7 + seed * 19.19) * 43758.5453
        return value - np.floor(value)

    start = corner(i, j) * (1 - u) + corner(i + 1, j) * u
    end = corner(i, j + 1) * (1 - u) + corner(i + 1, j + 1) * u
    return start * (1 - v) + end * v


# Neutral donor landmarks (metres) and matching reference pixels.
# Eyelid and lip borders stay registered with the real morphing surfaces.
LANDMARKS = np.array([
    [-.065, 1.752, 497, 76], [0, 1.752, 554, 69], [.064, 1.752, 602, 76],
    [-.060, 1.715, 499, 99], [0, 1.714, 551, 99], [.059, 1.715, 603, 99],
    [-.052, 1.680, 506, 112], [-.035, 1.686, 529, 108], [-.014, 1.683, 541, 111],
    [.052, 1.683, 598, 112], [.035, 1.689, 575, 107], [.014, 1.687, 557, 110],
    [-.048, 1.669, 512, 121], [-.033, 1.671, 526, 120], [-.019, 1.666, 539, 122],
    [.048, 1.670, 592, 121], [.033, 1.674, 578, 120], [.019, 1.669, 563, 123],
    [-.071, 1.649, 489, 144], [.071, 1.649, 607, 143],
    [-.018, 1.635, 538, 152], [0, 1.636, 553, 148], [.017, 1.635, 568, 151],
    [0, 1.622, 553, 163], [-.028, 1.606, 522, 174], [.028, 1.607, 583, 173],
    [0, 1.611, 552, 173], [0, 1.601, 552, 181], [0, 1.589, 551, 192],
    [-.049, 1.583, 510, 194], [.053, 1.585, 598, 193], [0, 1.554, 550, 216],
    [-.085, 1.653, 481, 144], [.085, 1.653, 612, 144],
    [-.044, 1.534, 509, 222], [0, 1.531, 553, 225], [.044, 1.534, 593, 222],
    [-.030, 1.505, 525, 235], [0, 1.505, 552, 246], [.030, 1.505, 577, 236],
])


def portrait_coordinates(x, y):
    """Fit a regularized thin-plate spline through paired neutral landmarks."""
    points = (LANDMARKS[:, :2] - [0, 1.64]) * 10
    planar = np.column_stack((np.ones(len(points)), points))

    def kernel(r2):
        return .5 * r2 * np.log(np.maximum(r2, 1e-12))

    distance = ((points[:, None] - points[None, :]) ** 2).sum(axis=-1)
    system = np.block([[kernel(distance) + np.eye(len(points)) * .0008, planar],
                       [planar.T, np.zeros((3, 3))]])
    coefficients = np.linalg.solve(system, np.vstack((LANDMARKS[:, 2:], np.zeros((3, 2)))))
    x, y = x * 10, (y - 1.64) * 10
    result = coefficients[-3] + x[..., None] * coefficients[-2] + y[..., None] * coefficients[-1]
    for (ax, ay), weight in zip(points, coefficients):
        result += kernel((x - ax) ** 2 + (y - ay) ** 2)[..., None] * weight
    return result


def face_albedo(donor, reference, size):
    rgb = image_array(donor / "images/image-03.jpg", size)
    surface = uv_surface(read_model(donor / "avatar.gltf"), "AvatarHead", size)
    valid = np.isfinite(surface[..., 0])
    x, y, z, _, _, nz = surface[valid].T
    absolute_x = abs(x)
    old = rgb[valid]
    detail = (rgb - blurred(rgb, 3.5))[valid]
    luma = old @ [.2126, .7152, .0722]
    skin = np.clip(np.array([190, 130, 99]) + (np.clip(luma, 137, 216) - 168)[:, None] * [.52, .45, .41]
                   + detail * .43, 0, 255)

    # Independently shaded wrap for the unseen cheeks, jaw and sideburns.
    grain = np.random.default_rng(823).normal(0, 1, len(x))
    azimuth = np.arctan2(x, z - .019)
    drop = y - 1.55
    curl = value_noise(azimuth * 12, drop * 189, 13)
    fiber_axis = azimuth + np.sign(x) * drop * (1.9 + 1.1 * np.abs(azimuth)) + curl * .043
    locks = value_noise(fiber_axis * 232, drop * 103, 54)
    fibers = value_noise(fiber_axis * 597, drop * 248, 65)
    texture = (locks - .5) * 1.12 + (fibers - .5) * .83 + grain * .27
    sideburn = smooth(.063, .079, absolute_x) * smooth(.004, .037, z) * (1 - smooth(.058, .083, z))
    cheek_edge = 1.612 + .037 * smooth(.030, .083, absolute_x)
    lower_beard = 1.545 + .039 * smooth(.028, .080, absolute_x)
    beard = smooth(lower_beard - .008, lower_beard + .009, y + texture * .0011)
    beard *= 1 - smooth(cheek_edge - .008, cheek_edge + .006, y + texture * .0018)
    beard *= smooth(.006, .068, z)
    beard = np.maximum(beard, sideburn * smooth(1.603, 1.630, y) * (1 - smooth(1.650, 1.678, y)))
    salt_area = value_noise(azimuth * 6.1, drop * 54, 9)
    salt = smooth(.45, .89, .59 * locks + .30 * fibers + .39 * salt_area)
    salt *= 1 - .49 * smooth(1.594, 1.657, y)
    whiskers = np.array([53, 47, 43]) + (salt * 59 + texture * 15)[:, None] * [1, 1.01, 1.07]
    skin = blend(skin, whiskers, beard)

    # Bake only the useful frontal skin and facial hair. In particular, retain
    # the donor's lid rims and the interior of its real mouth. The scalp tint
    # is applied by the fitted hairline in appearance.mjs.
    position = portrait_coordinates(x, y)
    px, py = position.T
    projected = sample_rgb(reference, px, py)
    dark = 1 - smooth(53, 142, projected @ [.2126, .7152, .0722])
    projected = blend(projected * [.91, .86, .86] + [3, 6, 6],
                      projected * [1.08, 1.06, 1.06] + [6, 5, 5], dark)
    brow_edge = smooth(107, 113, py) * (1 - smooth(119, 124, py))
    brow_edge *= smooth(10, 17, abs(px - 551)) * (1 - smooth(44, 51, abs(px - 551)))
    projected = blend(projected, np.array([119, 81, 57]), brow_edge * dark * .25)
    edge_y = [80, 112, 146, 167, 187, 201, 216, 230]
    left = np.interp(py, edge_y, [492, 490, 487, 491, 500, 516, 536, 550])
    right = np.interp(py, edge_y, [610, 611, 610, 605, 603, 586, 565, 552])
    cropped = smooth(0, 19, px - left) * smooth(0, 19, right - px)
    cropped *= smooth(70, 88, py) * (1 - smooth(214, 230, py))
    face_front = .96 * smooth(-.04, .52, nz) * smooth(.042, .087, z) * cropped

    eye_center = np.where(x < 0, 1.6685, 1.671)
    eye = ((absolute_x - .033) / .020) ** 2 + ((y - eye_center) / .0080) ** 2
    rim = 1 - smooth(.45, 1.25, eye)
    mouth = (x / .031) ** 2 + ((y - 1.606) / .0052) ** 2
    lips = (1 - smooth(.47, 1.40, mouth)) * smooth(.094, .112, z)
    rgb_face = blend(skin, projected, face_front * (1 - .92 * rim) * (1 - .65 * lips))
    native_rim = blend(old * [.91, .85, .82] + [15, 5, 2], old * [.86, .80, .76], lips)
    rgb_face = blend(rgb_face, native_rim, np.maximum(rim * .74, lips * .69) * smooth(.066, .095, z))

    # Neutralize the directional portrait shadows across the temples and
    # forehead while preserving the eyebrows, lid rims and fine skin detail.
    temple = smooth(.041, .064, absolute_x) * smooth(1.623, 1.649, y)
    temple *= 1 - smooth(1.718, 1.755, y)
    temple *= smooth(.022, .060, z)
    forehead = smooth(1.696, 1.723, y) * smooth(.028, .085, z)
    forehead *= 1 - smooth(.077, .096, absolute_x)
    brow = (1 - smooth(.047, .061, absolute_x)) * smooth(1.674, 1.682, y)
    brow *= 1 - smooth(1.703, 1.715, y)
    skin_transition = np.maximum(temple, forehead) * (1 - .96 * np.maximum(rim, brow))
    frontal_tone = (1 - smooth(.019, .085, absolute_x)) * smooth(.064, .125, z)
    even_skin = np.array([200, 137, 103]) + frontal_tone[:, None] * [18, 16, 15]
    even_skin += np.clip(detail, -10, 10) * .31 + grain[:, None] * .55
    rgb_face = blend(rgb_face, even_skin, skin_transition)

    result = rgb.copy()
    result[valid] = rgb_face
    return extend_islands(rgb, result, valid, 6)


def paint_shirt_front(cloth, x, y, z, nz):
    front = smooth(.06, .52, nz) * smooth(-.00062, -.00027, z)
    center = .000038 - .004 * y
    across = x - center
    along = smooth(.00046, .00060, y) * (1 - smooth(.00598, .00616, y))
    strip = (1 - smooth(.000118, .000140, abs(across))) * along
    stitch = np.exp(-((abs(across) - .000103) / .000008) ** 2) * along
    painted = blend(cloth, cloth * [.955, .950, .94], front * strip)
    painted -= (front * stitch * 3.4)[:, None]

    # The painted centres use the same spacing and scale as the original
    # design. Rasterizing in bind space keeps the row aligned across UV seams.
    for height in (.00152, .00237, .00321, .00406, .00491, .00575):
        dy = y - height
        usable = (abs(across) < .000077) & (abs(dy) < .000077) & (front > 0)
        dx, by = across[usable], dy[usable]
        radius = np.hypot(dx, by)
        coverage = front[usable] * (1 - smooth(.000060, .000069, radius))
        rim = smooth(.000042, .000058, radius) * (1 - smooth(.000058, .000066, radius))
        holes = 1 - smooth(.000005, .000011, np.hypot(abs(dx) - .000014, abs(by) - .000014))
        ink = np.array([47, 44, 38]) + rim[:, None] * [12, 11, 8] - holes[:, None] * 13
        painted[usable] = blend(painted[usable], ink, coverage)
    return painted


def clothing_albedo(donor, size):
    rgb = image_array(donor / "avatar03-texture.png", size)
    surface = uv_surface(read_model(donor / "avatar03.glb"), "Meshy", size)
    valid = np.isfinite(surface[..., 0])
    x, y, z, nx, _, nz = surface[valid].T
    ax = abs(x)
    source = rgb[valid]
    red, green, blue = source.T
    luma = source @ [.2126, .7152, .0722]
    detail = (rgb - blurred(rgb, 7))[valid] @ [.2126, .7152, .0722]
    grain = np.random.default_rng(401).normal(0, .95, len(ax))
    purple = smooth(5, 20, red - green) * smooth(8, 31, blue - green) * smooth(-2, 15, blue - red)
    neckline = smooth(5, 10, blue - green) * smooth(.77, .89, blue / np.maximum(1, red)) * smooth(.0048, .0056, y)
    purple = np.maximum(purple, neckline)
    shirt = purple * smooth(-.0011, -.0004, y)
    fabric_stitch = np.sin(x * 1.7e5) * .42 + np.sin(y * 1.5e5) * .43 + grain
    # Paint the sleeve cuff, flat-felled shoulder seam and curved hem in UV space.
    cuff_axis = .58 * ax - .81 * y
    cuff = smooth(.00204, .00218, cuff_axis) * smooth(.0035, .0040, ax)
    cuff_seam = np.exp(-((cuff_axis - .00217) / .000039) ** 2) * smooth(.0035, .0040, ax)
    shoulder_x = .00193 + (.0057 - y) * .39
    shoulder = np.exp(-((ax - shoulder_x) / .000039) ** 2) * smooth(.00395, .00417, y) * (1 - smooth(.00595, .00628, y))
    hem_at = .00062 + .00017 * smooth(.0006, .0018, ax)
    hem = np.exp(-((y - hem_at) / .000041) ** 2) * (1 - smooth(.00175, .00196, ax))
    knit_weight = .18 + .18 * smooth(.00085, .0022, y)
    plain_shirt = np.array([76, 72, 57]) + ((luma - 120) * knit_weight
                   + np.clip(detail, -13, 13) * .19 + fabric_stitch + cuff * 3
                   - cuff_seam * 6 - shoulder * 5 - hem * 4)[:, None] * [1, 1, .9]
    plain_shirt = paint_shirt_front(plain_shirt, x, y, z, nz)

    trousers = smooth(-.00917, -.00852, y) * (1 - smooth(.00070, .00118, y))
    trousers *= (1 - smooth(34, 83, luma)) * (1 - purple) * (1 - smooth(.0029, .0033, ax))
    outseam = np.exp(-((abs(nx) - .94) / .064) ** 2) * (1 - smooth(.0035, .004, abs(y + .005)))
    fly = np.exp(-((x - .00010) / .000065) ** 2) * smooth(.0003, .0009, z) * smooth(-.0011, -.0007, y)
    pants = np.array([39, 38, 43]) + (np.clip((luma - 14) * .42, -8, 15)
            + detail * .35 - outseam * 2 - fly * 4 + fabric_stitch * .65)[:, None]

    shoe = (1 - smooth(-.00831, -.00799, y)) * smooth(37, 101, luma) * (1 - purple)
    sole = 1 - smooth(-.00913, -.00898, y)
    tread = (1 - smooth(-.00943, -.00932, y)) * (.62 + .38 * smooth(.00142, .0019, abs(z)))
    toe_panel = smooth(.00105, .00124, z)
    overlay = np.exp(-((z - .00054 + (y + .009) * .62) / .00015) ** 2) * (1 - smooth(.46, .8, nz))
    shoe_color = blend(np.array([185, 177, 165]) - overlay[:, None] * [18, 17, 16],
                       np.array([217, 210, 198]), toe_panel * .72)
    shoe_color = blend(shoe_color, np.array([207, 201, 189]), sole)
    shoe_color = blend(shoe_color, np.array([57, 54, 51]), tread)
    shoe_color += (np.clip((luma - 160) * .22, -20, 17) + detail * .24 + grain)[:, None]

    painted = blend(source * [.95, .87, .80] + [7, 5, 3], plain_shirt, shirt)
    painted = blend(painted, pants, trousers)
    painted = blend(painted, shoe_color, shoe)
    result = rgb.copy()
    result[valid] = painted
    return extend_islands(rgb, result, valid, 7)


def fingerprint(path):
    with path.open("rb") as source:
        sha256 = hashlib.file_digest(source, "sha256").hexdigest()
    return {"file": path.name, "bytes": path.stat().st_size, "sha256": sha256}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("reference", type=Path)
    parser.add_argument("donor_assets", type=Path, help="Built Hybrid 0.1.3 dist/assets directory")
    args = parser.parse_args()
    reference = Image.open(args.reference).convert("RGB")
    if reference.size != (1122, 1402):
        parser.error("The landmark calibration expects the original 1122×1402 reference.")
    output = Path(__file__).resolve().parents[1] / "assets"
    output.mkdir(exist_ok=True)
    face = output / "olive-face-albedo.jpg"
    clothes = output / "olive-clothing-albedo.jpg"
    donor = args.donor_assets
    image = np.array(reference, dtype=np.float32)
    Image.fromarray(np.uint8(np.clip(face_albedo(donor / "avatar-v2", image, 1536), 0, 255))).save(
        face, quality=94, subsampling=0, optimize=True)
    Image.fromarray(np.uint8(np.clip(clothing_albedo(donor, 2048), 0, 255))).save(
        clothes, quality=92, subsampling=0, optimize=True)
    manifest = {"schemaVersion": 1, "reference": fingerprint(args.reference),
                "donors": [fingerprint(donor / name) for name in (
                    "avatar03.glb", "avatar03-texture.png", "avatar-v2/avatar.gltf",
                    "avatar-v2/avatar.bin", "avatar-v2/images/image-03.jpg")],
                "generated": [fingerprint(face), fingerprint(clothes)]}
    (output / "provenance.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()

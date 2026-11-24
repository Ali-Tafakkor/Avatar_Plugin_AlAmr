"""Bake the Blue Man reference and garment details in the existing Hybrid UVs."""

import argparse
import importlib.util
import json
from pathlib import Path

import numpy as np
from PIL import Image


AVATAR = Path(__file__).resolve().parents[1]
# The existing baker owns the donor glTF/UV reader, gutter expansion and sampler.
spec = importlib.util.spec_from_file_location(
    "avatar_uv", AVATAR.parent / "avatar-olive-man/tools/bake-albedo.py")
uv = importlib.util.module_from_spec(spec)
spec.loader.exec_module(uv)

# Paired donor-space neutral landmarks (metres) and reference pixels.
# The projected photo is masked back around the animated mouth and eyelids.
LANDMARKS = np.array([
    [-.065, 1.752, 449, 93], [0, 1.752, 500, 74], [.064, 1.752, 553, 94],
    [-.060, 1.715, 444, 114], [0, 1.714, 502, 112], [.059, 1.715, 557, 113],
    [-.052, 1.680, 451, 129], [-.035, 1.686, 470, 123], [-.014, 1.683, 490, 127],
    [.052, 1.683, 549, 130], [.035, 1.689, 535, 123], [.014, 1.687, 515, 125],
    [-.048, 1.669, 456, 140], [-.033, 1.671, 472, 138], [-.019, 1.666, 488, 142],
    [.048, 1.670, 545, 141], [.033, 1.674, 532, 137], [.019, 1.669, 516, 142],
    [-.071, 1.649, 437, 158], [.071, 1.649, 565, 158],
    [-.018, 1.635, 484, 173], [0, 1.636, 502, 170], [.017, 1.635, 520, 173],
    [0, 1.622, 502, 185], [-.028, 1.606, 472, 195], [.028, 1.607, 533, 195],
    [0, 1.611, 502, 193], [0, 1.601, 501, 199], [0, 1.589, 502, 211],
    [-.049, 1.583, 458, 221], [.053, 1.585, 545, 221], [0, 1.554, 502, 244],
    [-.085, 1.653, 429, 160], [.085, 1.653, 576, 160],
    [-.044, 1.534, 457, 249], [0, 1.531, 502, 255], [.044, 1.534, 546, 249],
    [-.030, 1.505, 477, 266], [0, 1.505, 502, 265], [.030, 1.505, 527, 266],
])
LUMA = np.array([.2126, .7152, .0722])
smooth, blend = uv.smooth, uv.blend


def portrait_coordinates(x, y):
    def kernel(distance_squared):
        return .5 * distance_squared * np.log(np.maximum(distance_squared, 1e-12))

    points = (LANDMARKS[:, :2] - [0, 1.64]) * 10
    affine = np.column_stack((np.ones(len(points)), points))
    distances = ((points[:, None] - points[None, :]) ** 2).sum(axis=-1)
    system = np.block([[kernel(distances) + np.eye(len(points)) * .0008, affine],
                       [affine.T, np.zeros((3, 3))]])
    weights = np.linalg.solve(system, np.vstack((LANDMARKS[:, 2:], np.zeros((3, 2)))))
    x, y = x * 10, (y - 1.64) * 10
    result = weights[-3] + x[:, None] * weights[-2] + y[:, None] * weights[-1]
    for (ax, ay), weight in zip(points, weights):
        result += kernel((x - ax) ** 2 + (y - ay) ** 2)[:, None] * weight
    return result.T


def face_albedo(donor, reference, size):
    rgb = uv.image_array(donor / "images/image-03.jpg", size)
    surface = uv.uv_surface(uv.read_model(donor / "avatar.gltf"), "AvatarHead", size)
    valid = np.isfinite(surface[..., 0])
    x, y, z, _, _, nz = surface[valid].T
    side = abs(x)
    old = rgb[valid]
    luma = old @ LUMA
    detail = (rgb - uv.blurred(rgb, 3.5))[valid]
    skin = np.array([196, 139, 111]) + (np.clip(luma, 128, 215) - 173)[:, None] * [.46, .46, .43]
    skin += np.clip(detail, -16, 16) * .34

    # The jaw wraps into the sides with a diffused, short pepper-and-salt
    # beard. Changes in density reveal the jaw rather than forming a hard mask.
    angle = np.arctan2(x, z - .018)
    height = y - 1.55
    flow = angle + np.sign(x) * height * (1.1 + np.abs(angle))
    salt = uv.value_noise(flow * 230, height * 190, 63)
    strands = uv.value_noise(flow * 640, height * 318, 22)
    clusters = uv.value_noise(angle * 10, height * 80, 17)
    texture = .57 * salt + .30 * strands + .23 * clusters
    edge = (texture - .5) * .005
    top = 1.610 + .046 * smooth(.035, .080, side)
    bottom = 1.546 + .026 * smooth(.025, .084, side)
    jaw = smooth(bottom - .007, bottom + .008, y + edge) * (1 - smooth(top - .009, top + .008, y + edge))
    jaw *= smooth(.008, .069, z)
    near_ear = smooth(.057, .071, side) * smooth(.017, .032, z) * (1 - smooth(.053, .080, z))
    sideburn = near_ear * smooth(1.617, 1.637, y) * (1 - smooth(1.660, 1.686, y))
    gray = smooth(.38, .80, texture) * (1 - .26 * smooth(1.591, 1.657, y))
    hair = np.array([62, 55, 53]) + (gray * 58 + (strands - .5) * 22)[:, None] * [1, 1.03, 1.10]
    face = blend(skin, hair, np.maximum(jaw, sideburn))

    px, py = portrait_coordinates(x, y)
    projected = uv.sample_rgb(reference, px, py)
    lightness = projected @ LUMA
    # Compress the bright portrait's broad tonal range and retain finer
    # variations without doubling the reference shadows under scene light.
    lifted = projected * [.79, .80, .81] + [25, 19, 18]
    lifted += (19 * (1 - smooth(60, 156, lightness)))[:, None]
    age_detail = (projected - uv.sample_rgb(uv.blurred(reference, 2.5), px, py)) * .14
    lifted += np.clip(age_detail, -6, 6)
    forehead = smooth(82, 99, py) * (1 - smooth(113, 130, py))
    central = 1 - smooth(17, 49, abs(px - 500))
    lifted = blend(lifted, np.array([205, 147, 117]), forehead * central * .18)
    mustache = smooth(171, 181, py) * (1 - smooth(189, 195, py))
    mustache *= 1 - smooth(23, 38, abs(px - 501))
    lifted -= (mustache * (1 - smooth(72, 142, lightness)) * 20)[:, None]
    edge_y = [71, 98, 130, 162, 189, 216, 234, 249]
    left = np.interp(py, edge_y, [462, 444, 439, 439, 443, 451, 474, 487])
    right = np.interp(py, edge_y, [546, 556, 563, 564, 562, 552, 532, 516])
    crop = smooth(0, 17, px - left) * smooth(0, 17, right - px)
    crop *= smooth(74, 94, py) * (1 - smooth(238, 254, py))
    front = smooth(-.07, .5, nz) * smooth(.040, .086, z) * crop
    eye_y = np.where(x < 0, 1.669, 1.672)
    eye = ((side - .033) / .021) ** 2 + ((y - eye_y) / .0087) ** 2
    rim = 1 - smooth(.49, 1.30, eye)
    mouth = (x / .032) ** 2 + ((y - 1.606) / .0055) ** 2
    lips = (1 - smooth(.55, 1.42, mouth)) * smooth(.091, .112, z)
    face = blend(face, lifted, front * .91 * (1 - .96 * rim) * (1 - .8 * lips))
    native = blend(old * [.84, .84, .84] + [28, 19, 16], old * [.87, .83, .82], lips)
    face = blend(face, native, np.maximum(rim * .76, lips * .72) * smooth(.066, .095, z))
    result = rgb.copy()
    result[valid] = face
    return uv.extend_islands(rgb, result, valid, 6)


def paint_placket(cloth, x, y, z, nz):
    front = smooth(.08, .45, nz) * smooth(-.00060, -.00026, z)
    across = x - .000040 + .003 * y
    along = smooth(.00043, .00061, y) * (1 - smooth(.00560, .00595, y))
    strip = (1 - smooth(.000105, .000139, abs(across))) * along
    seam = np.exp(-((abs(across) - .000107) / .000010) ** 2) * along
    painted = blend(cloth, cloth * [.93, .94, .96], front * strip)
    painted -= (front * seam * 4.0)[:, None]
    for height in (.00153, .00233, .00313, .00393, .00473, .00553):
        dy = y - height
        use = (abs(across) < .000080) & (abs(dy) < .000080) & (front > 0)
        bx, by = across[use], dy[use]
        radius = np.hypot(bx, by)
        coverage = front[use] * (1 - smooth(.000059, .000071, radius))
        rim = smooth(.000038, .000056, radius) * (1 - smooth(.000058, .000069, radius))
        holes = 1 - smooth(.000005, .000011, np.hypot(abs(bx) - .000013, abs(by) - .000013))
        color = np.array([111, 124, 148]) + rim[:, None] * [17, 17, 18] - holes[:, None] * 29
        painted[use] = blend(painted[use], color, coverage)
    return painted


def clothing_albedo(donor, size):
    rgb = uv.image_array(donor / "avatar03-texture.png", size)
    surface = uv.uv_surface(uv.read_model(donor / "avatar03.glb"), "Meshy", size)
    valid = np.isfinite(surface[..., 0])
    x, y, z, nx, _, nz = surface[valid].T
    side = abs(x)
    source = rgb[valid]
    red, green, blue = source.T
    luma = source @ LUMA
    detail = (rgb - uv.blurred(rgb, 7))[valid] @ LUMA
    grain = np.random.default_rng(2307).normal(0, .8, len(x))
    purple = smooth(5, 20, red - green) * smooth(8, 31, blue - green) * smooth(-2, 15, blue - red)
    neck_textile = smooth(5, 10, blue - green) * smooth(.77, .89, blue / np.maximum(1, red))
    purple = np.maximum(purple, neck_textile * smooth(.0048, .0056, y))
    shirt = purple * smooth(-.0011, -.0004, y)
    weave = grain + .52 * np.sin(x * 1.6e5) * np.sin(y * 1.45e5)
    cuff_axis = .58 * side - .81 * y
    cuff = smooth(.00204, .00218, cuff_axis) * smooth(.0035, .0040, side)
    cuff_seam = np.exp(-((cuff_axis - .00217) / .000037) ** 2) * smooth(.0035, .0040, side)
    shoulder_x = .00193 + (.0057 - y) * .39
    shoulder = np.exp(-((side - shoulder_x) / .000043) ** 2)
    shoulder *= smooth(.00395, .00417, y) * (1 - smooth(.00595, .00628, y))
    hem_y = .00059 + .00024 * smooth(.00061, .00182, side)
    hem = np.exp(-((y - hem_y) / .000030) ** 2) * (1 - smooth(.00172, .00196, side))
    textile = ((luma - 121) * .26 + np.clip(detail, -17, 17) * .19 + weave
               + cuff * 2 - cuff_seam * 5 - shoulder * 4 - hem * 5)
    shirt_rgb = np.array([61, 86, 132]) + textile[:, None] * [.90, .97, 1.07]
    shirt_rgb = paint_placket(shirt_rgb, x, y, z, nz)

    pants = smooth(-.00917, -.00853, y) * (1 - smooth(.00072, .00118, y))
    pants *= (1 - smooth(38, 98, luma)) * (1 - purple) * (1 - smooth(.0029, .0033, side))
    outseam = np.exp(-((abs(nx) - .94) / .066) ** 2) * (1 - smooth(.0035, .004, abs(y + .005)))
    fly = np.exp(-((x - .00010) / .000063) ** 2) * smooth(.0003, .0009, z) * smooth(-.0011, -.0007, y)
    fabric = np.clip((luma - 16) * .38, -7, 19) + detail * .25 + weave - outseam * 4 - fly * 5
    khaki = np.array([111, 91, 68]) + fabric[:, None] * [1.0, .94, .88]

    shoe = (1 - smooth(-.00831, -.00799, y)) * smooth(37, 101, luma) * (1 - purple)
    sole = 1 - smooth(-.00923, -.00914, y)
    tread = (1 - smooth(-.00945, -.00933, y)) * (.65 + .35 * smooth(.00142, .0019, abs(z)))
    toe = smooth(.00093, .00128, z)
    welt = np.exp(-((y + .00902) / .000038) ** 2)
    quarter_seam = np.exp(-((z - .00064 + (y + .009) * .62) / .000057) ** 2)
    leather = np.array([58, 42, 36]) + (toe * 8 - quarter_seam * 7 + welt * 14)[:, None]
    shoe_rgb = blend(leather, np.array([141, 118, 90]), sole)
    shoe_rgb = blend(shoe_rgb, np.array([62, 49, 39]), tread)
    shoe_rgb += (np.clip((luma - 160) * .15, -13, 13) + detail * .22 + grain)[:, None]
    painted = blend(source * [.96, .90, .85] + [7, 6, 5], shirt_rgb, shirt)
    painted = blend(painted, khaki, pants)
    painted = blend(painted, shoe_rgb, shoe)
    result = rgb.copy()
    result[valid] = painted
    return uv.extend_islands(rgb, result, valid, 7)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("reference", type=Path)
    parser.add_argument("donor_assets", type=Path)
    args = parser.parse_args()
    reference = Image.open(args.reference).convert("RGB")
    if reference.size != (1024, 1536):
        parser.error("The landmark calibration expects the original 1024×1536 reference.")
    output, donor = AVATAR / "assets", args.donor_assets
    face = output / "blue-face-albedo.jpg"
    clothes = output / "blue-clothing-albedo.jpg"
    pixels = np.asarray(reference, dtype=np.float32)
    Image.fromarray(np.uint8(np.clip(face_albedo(donor / "avatar-v2", pixels, 1536), 0, 255))).save(
        face, quality=94, subsampling=0, optimize=True)
    Image.fromarray(np.uint8(np.clip(clothing_albedo(donor, 2048), 0, 255))).save(
        clothes, quality=92, subsampling=0, optimize=True)
    manifest = {"schemaVersion": 1, "reference": uv.fingerprint(args.reference),
                "donors": [uv.fingerprint(donor / name) for name in (
                    "avatar03.glb", "avatar03-texture.png", "avatar-v2/avatar.gltf",
                    "avatar-v2/avatar.bin", "avatar-v2/images/image-03.jpg")],
                "generated": [uv.fingerprint(face), uv.fingerprint(clothes)]}
    (output / "provenance.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()

"""Author the elder outfit in the existing skinned garment's UV coordinates."""
import importlib.util
from pathlib import Path
import numpy as np
from PIL import Image
AVATAR = Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('uv',AVATAR.parent/'avatar-olive-man/tools/bake-albedo.py')
uv=importlib.util.module_from_spec(spec)
spec.loader.exec_module(uv)
smooth,blend=uv.smooth,uv.blend
LUMA=np.array([.2126,.7152,.0722])
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
        color = np.array([127, 116, 110]) + rim[:, None] * [17, 17, 18] - holes[:, None] * 29
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
    shirt_rgb = np.array([116, 103, 99]) + textile[:, None] * [1.0, .97, .95]
    shirt_rgb = paint_placket(shirt_rgb, x, y, z, nz)

    pants = smooth(-.00917, -.00853, y) * (1 - smooth(.00072, .00118, y))
    pants *= (1 - smooth(38, 98, luma)) * (1 - purple) * (1 - smooth(.0029, .0033, side))
    outseam = np.exp(-((abs(nx) - .94) / .066) ** 2) * (1 - smooth(.0035, .004, abs(y + .005)))
    fly = np.exp(-((x - .00010) / .000063) ** 2) * smooth(.0003, .0009, z) * smooth(-.0011, -.0007, y)
    fabric = np.clip((luma - 16) * .38, -7, 19) + detail * .25 + weave - outseam * 4 - fly * 5
    khaki = np.array([39, 35, 34]) + fabric[:, None] * [1.0, .94, .88]

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


if __name__=='__main__':
    donor=AVATAR.parent/'آواتار/dist/assets'
    image=clothing_albedo(donor,2048)
    Image.fromarray(np.uint8(np.clip(image,0,255))).save(AVATAR/'assets/elder-clothing-albedo.jpg',quality=92,subsampling=0,optimize=True)

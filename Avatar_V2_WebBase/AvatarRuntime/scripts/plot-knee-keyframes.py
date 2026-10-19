"""Plot measured V2 joints in side view; this is a rig diagnostic, not a mesh render."""
import json
import sys
from pathlib import Path

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

input_path = Path(sys.argv[1])
output_path = Path(sys.argv[2])
report = json.loads(input_path.read_text(encoding='utf-8-sig'))
fig, axes = plt.subplots(2, 4, figsize=(12, 7), sharex=True, sharey=True)
for row, state in enumerate(('walk', 'run')):
    samples = report['poses'][state]['samples']
    for column, sample_index in enumerate((1, 2, 4, 6)):
        sample = samples[sample_index]
        ax = axes[row, column]
        for side, color, width in (('right', '#d18b2c', 2.6), ('left', '#1679a7', 3.6)):
            knee = sample['knees'][side]
            points = [knee['hip'], knee['knee'], knee['ankle']]
            ax.plot([p[2] for p in points], [p[1] for p in points], '-o', color=color, linewidth=width,
                    markersize=5, alpha=.9, label=side)
            ax.annotate(f"{knee['flexDeg']:.0f} deg", (points[1][2], points[1][1]),
                        xytext=(4, 7 if side == 'left' else -16), textcoords='offset points', fontsize=8, color=color)
        ax.axhline(0, color='#52616b', linewidth=1)
        ax.set_title(f"{state.title()}  /  t={sample['frame'] / report['sampleRateHz']:.2f} s", fontsize=10)
        ax.set_aspect('equal', adjustable='box')
        ax.set_xlim(-.65, .65)
        ax.set_ylim(-.03, .99)
        ax.grid(alpha=.15)
        if column == 0:
            ax.set_ylabel('Height above floor (m)')
        if row == 1:
            ax.set_xlabel('Behind  <-  Z (m)  ->  Forward')
axes[0, 0].legend(loc='upper left', fontsize=8)
fig.suptitle('V2 measured knee hinges: side-view keyframes', fontsize=16, y=.98)
fig.text(.5, .018, 'Actual joint projection; knee labels show flexion. Mesh appearance is verified separately in Al-Amr Desktop.',
         ha='center', fontsize=9, color='#52616b')
fig.tight_layout(rect=(0, .04, 1, .94))
fig.savefig(output_path, dpi=180, facecolor='white')
print(output_path.resolve())

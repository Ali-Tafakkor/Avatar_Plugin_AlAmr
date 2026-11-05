"""Create and compare a local int8 speech model without changing the originals."""
import hashlib
import json
import pathlib
import sys
import time
import wave

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / '.local/python-speech'))
import onnx
import onnxruntime as ort
import numpy as np
from onnxruntime.quantization import QuantType, quantize_dynamic

source = ROOT / '.local/speech-models/wav2arkit'
output = ROOT / '.local/speech-models/wav2arkit-int8'
output.mkdir(parents=True, exist_ok=True)
target = output / 'wav2arkit_cpu.onnx'
expected = {'wav2arkit_cpu.onnx': 'cdecbfad3915dd20b2f0718942d0b8894b2ee11edcc5a9a9da45d29a46af2ed9',
            'wav2arkit_cpu.onnx.data': 'c0f0364673c6e50be126b193e2b56809c16ac6bee4805aea9b8251ce53429bf8'}
for name, digest in expected.items():
    if hashlib.sha256((source/name).read_bytes()).hexdigest() != digest:
        raise RuntimeError('Original model hash mismatch: ' + name)
quantize_dynamic(str(source/'wav2arkit_cpu.onnx'), str(target), weight_type=QuantType.QInt8,
                 per_channel=True, op_types_to_quantize=['MatMul', 'Gemm'],
                 use_external_data_format=False, extra_options={'MatMulConstBOnly': True})
onnx.checker.check_model(str(target))
options = ort.SessionOptions()
options.intra_op_num_threads = 1
options.inter_op_num_threads = 1
baseline = ort.InferenceSession(str(source/'wav2arkit_cpu.onnx'), options, providers=['CPUExecutionProvider'])
compact = ort.InferenceSession(str(target), options, providers=['CPUExecutionProvider'])
with wave.open(str(ROOT/'.local/speech-evaluation/microphone-speech.wav'),'rb') as audio:
    samples = np.frombuffer(audio.readframes(audio.getnframes()),dtype='<i2').astype(np.float32)/32768
    original_rate = audio.getframerate()
samples = np.interp(np.arange(round(len(samples)*16000/original_rate))*original_rate/16000,
                    np.arange(len(samples)),samples).astype(np.float32)
errors = []
benchmarks = []
for offset in range(0, min(len(samples)-3200,16000*8),3200):
    window = samples[offset:offset+3200][None,:]
    start = time.perf_counter(); first = baseline.run(None,{baseline.get_inputs()[0].name:window})[0]
    fp_ms = (time.perf_counter()-start)*1000
    start = time.perf_counter(); second = compact.run(None,{compact.get_inputs()[0].name:window})[0]
    int8_ms = (time.perf_counter()-start)*1000
    if first.shape != second.shape or first.shape[-1] != 52 or not np.isfinite(second).all():
        raise RuntimeError('Invalid compact model output')
    errors.append(np.abs(first-second).reshape(-1))
    benchmarks.append({'atSeconds':offset/16000,'fp32Ms':fp_ms,'int8Ms':int8_ms})
error = np.concatenate(errors)
receipt = {'source':'myned-ai/wav2arkit_cpu','revision':'48b7d27a147d4dfcce4c8225b11209ce4cd76e05',
           'originalSha256':expected,'quantization':'ORT dynamic int8 MatMul/Gemm, per-channel',
           'onnxVersion':onnx.__version__,'onnxRuntimeVersion':ort.__version__,
           'file':target.name,'bytes':target.stat().st_size,'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),
           'checker':'pass','nativeOutputComparison':{'windows':len(benchmarks),'durationSeconds':0.2,
               'meanAbsoluteError':float(error.mean()),'maxAbsoluteError':float(error.max()),
               'p99AbsoluteError':float(np.quantile(error,0.99)),'scope':'Synthetic English speech, not user/Persian acceptance'},
           'benchmarks':benchmarks}
(output/'provenance.json').write_text(json.dumps(receipt,indent=2)+'\n',encoding='utf-8')
print(json.dumps({key:value for key,value in receipt.items() if key!='benchmarks'},indent=2))

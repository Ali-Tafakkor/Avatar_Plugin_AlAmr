# Speech pipeline provenance

YAMNet audio-event model: Google / TensorFlow Models, with ONNX conversion by
zeropointnine. Selected conversion revision:
ac2ca3bd45d12ec1f19f1144205ea529b4e9dedf. Model card declares Apache-2.0.
https://www.tensorflow.org/hub/tutorials/yamnet
https://huggingface.co/zeropointnine/yamnet-onnx
The local model provenance records exact bytes and hashes. The classifier
recognizes audible events, not a person's internal emotional state.

ONNX Runtime Web 1.29.0 is Microsoft MIT-licensed runtime code. Its WASM is
supplied by the consuming Environment, outside this Plugin's WASM modules.
Evaluation audio is not included in this package.

The raw ARKit channel order and the ONNX tensor/session adaptation derive from
`NavodPeiris/gsplat-talkinghead` at commit
`5da2574ef3fc9820c3d74cc89e00a0c3c771091a` (MIT). The microphone capture,
dedicated worker transport, queue/lifecycle handling and resampling are local
integration code. No Gaussian mouth gain or neutral smile bias is copied.

The wav2arkit model has a separate Apache-2.0 model license. Model revision,
download hashes and any local quantization are recorded by the host asset setup;
the MIT notice below does not replace the model or avatar asset licenses.

MIT License

Copyright (c) 2026 Navod Peiris

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

"""Synthetic, metadata-only tests. No real avatar or WebGL is loaded."""
from __future__ import annotations
import copy
import hashlib
import json
from pathlib import Path
import struct
import subprocess
import sys
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from inspect_glb import parse_glb, audit, norm_bone, norm_shape
from validate_profile import read_json, validate


def profile(): return read_json(ROOT/'assets/avatar-profile.template.json')
def fixture():
    """Minimal metadata fixture; intentionally not claimed to be renderable geometry."""
    p=profile(); nodes=[]
    def add(name,parent=None):
        i=len(nodes); nodes.append({'name':name})
        if parent is not None: nodes[parent].setdefault('children',[]).append(i)
        return i
    hips=add('hips'); spine=add('spine',hips); add('head',spine)
    for side in ('left','right'):
        upper=add(side+'UpperArm',spine); lower=add(side+'LowerArm',upper); add(side+'Hand',lower)
        upper=add(side+'UpperLeg',hips); lower=add(side+'LowerLeg',upper); add(side+'Foot',lower)
    joints=list(range(len(nodes)))
    nodes.append({'name':'BodyMeshNode','mesh':0,'skin':0})
    names=p['face']['requiredChannels']+['BodyWeight']
    return {'asset':{'version':'2.0'},'nodes':nodes,'skins':[{'joints':joints}],
        'meshes':[{'name':'FaceAndBody','extras':{'targetNames':names},'primitives':[{'attributes':{'POSITION':0,'JOINTS_0':1,'WEIGHTS_0':2},'indices':3,'targets':[{'POSITION':4} for _ in names]}]}],
        'accessors':[{'count':3} for _ in range(5)],'scenes':[{'nodes':[0,len(nodes)-1]}],'scene':0}

def glb(doc, extra=b''):
    encoded=json.dumps(doc,separators=(',',':')).encode(); encoded+=b' '*((-len(encoded))%4)
    body=struct.pack('<II',len(encoded),0x4E4F534A)+encoded+extra
    return struct.pack('<III',0x46546C67,2,len(body)+12)+body

class ProfileTests(unittest.TestCase):
    def test_draft_is_valid_but_unresolved(self):
        r=validate(profile()); self.assertEqual(r['status'],'pass'); self.assertTrue(r['warnings'])
    def test_template_not_release_ready(self): self.assertEqual(validate(profile(),True)['status'],'fail')
    def test_identity_is_not_hardcoded(self):
        p=profile(); self.assertIsNone(p['appearance']['presentation']); self.assertIsNone(p['normalization']['targetHeightMeters']); self.assertIsNone(p['assets']['model'])
    def test_unknown_property_rejected(self):
        p=profile(); p['invented']=True; self.assertEqual(validate(p)['status'],'fail')
    def test_wrong_numeric_type_rejected(self):
        p=profile(); p['movement']['walkSpeedMps']='fast'; self.assertEqual(validate(p)['status'],'fail')
    def test_boolean_not_number(self):
        p=profile(); p['movement']['walkSpeedMps']=True; self.assertEqual(validate(p)['status'],'fail')
    def test_run_must_be_faster(self):
        p=profile(); p['movement']['runSpeedMps']=0.5; self.assertEqual(validate(p)['status'],'fail')
    def test_nonfinite_rejected(self):
        p=profile(); p['face']['intensity']=float('nan'); self.assertEqual(validate(p)['status'],'fail')
    def test_expression_range(self):
        p=profile(); p['face']['intensity']=2; self.assertEqual(validate(p)['status'],'fail')
    def test_preserve_identity_required(self):
        p=profile(); p['face']['preserveUnownedMorphs']=False; self.assertEqual(validate(p)['status'],'fail')
    def test_mapping_ranges_checked(self):
        p=profile(); p['face']['bindings']['jawOpen']=[{'mesh':0,'target':0,'gain':1,'offset':0,'min':1,'max':0}]; self.assertEqual(validate(p)['status'],'fail')
    def test_blink_interval_checked(self):
        p=profile(); p['face']['blink']['waitMaxSeconds']=0.1; self.assertEqual(validate(p)['status'],'fail')
    def test_preset_channels_are_finite_and_bounded(self):
        data=read_json(ROOT/'assets/facial-presets.json')['emotions']; self.assertEqual(set(data),{'neutral','smile','laugh','sad','angry','surprise'})
        for preset in data.values():
            for value in preset['values'].values(): self.assertTrue(0 <= value <= 1)

class GLBTests(unittest.TestCase):
    def test_valid_json_only_container(self): self.assertEqual(parse_glb(glb(fixture()))['json']['asset']['version'],'2.0')
    def test_optional_binary_chunk(self):
        d=parse_glb(glb(fixture(),struct.pack('<II',4,0x004E4942)+b'\0'*4)); self.assertEqual(d['binBytes'],4)
    def test_truncation_rejected(self):
        with self.assertRaises(ValueError): parse_glb(glb(fixture())[:-1])
    def test_bad_magic_rejected(self):
        with self.assertRaises(ValueError): parse_glb(b'BAD!'+glb(fixture())[4:])
    def test_version_rejected(self):
        data=bytearray(glb(fixture())); struct.pack_into('<I',data,4,1)
        with self.assertRaises(ValueError): parse_glb(bytes(data))
    def test_json_must_be_first(self):
        data=bytearray(glb(fixture())); struct.pack_into('<I',data,16,0x004E4942)
        with self.assertRaises(ValueError): parse_glb(bytes(data))
    def test_duplicate_json_rejected(self):
        extra=struct.pack('<II',4,0x4E4F534A)+b'{}  '
        with self.assertRaises(ValueError): parse_glb(glb(fixture(),extra))
    def test_chunk_alignment_rejected(self):
        data=bytearray(glb(fixture())); struct.pack_into('<I',data,12,3)
        with self.assertRaises(ValueError): parse_glb(bytes(data))
    def test_metadata_full_coverage(self):
        r=audit(fixture()); self.assertEqual(r['status'],'metadata-checks-passed'); self.assertIn('actual morph deltas',r['unverified'])
    def test_names_normalize(self):
        self.assertEqual(norm_bone('Armature|mixamorig:LeftUpLeg'),'leftupleg'); self.assertEqual(norm_shape('blendShape.mouthSmile_Left'),'mouthsmileleft')
    def test_duplicate_bone_is_not_overwritten(self):
        d=fixture(); d['nodes'].append({'name':'mixamorig:Hips'}); d['skins'][0]['joints'].append(len(d['nodes'])-1)
        r=audit(d); self.assertIn('hips',r['ambiguousBones']); self.assertNotIn('hips',r['boneMapping'])
    def test_explicit_bone_index_resolves_ambiguity(self):
        d=fixture(); d['nodes'].append({'name':'mixamorig:Hips'}); d['skins'][0]['joints'].append(len(d['nodes'])-1)
        p=profile(); p['rig']['bones']['hips']=0; self.assertEqual(audit(d,p)['boneMapping']['hips']['nodeIndex'],0)
    def test_missing_bilateral_channel_reported(self):
        d=fixture(); n=d['meshes'][0]['extras']['targetNames']; n[n.index('eyeBlinkRight')]='not-a-blink'
        self.assertIn('eyeBlinkRight',audit(d)['missingFaceChannels'])
    def test_morph_count_is_not_face_capability(self):
        d=fixture(); d['meshes'][0]['extras']['targetNames']=['unknown'+str(i) for i in range(len(d['meshes'][0]['extras']['targetNames']))]
        self.assertTrue(audit(d)['missingFaceChannels'])
    def test_explicit_index_binding(self):
        d=fixture(); names=d['meshes'][0]['extras']['targetNames']; index=names.index('jawOpen'); names[index]='CustomJaw'
        p=profile(); p['face']['bindings']['jawOpen']=[{'mesh':0,'target':index,'gain':1,'offset':0,'min':0,'max':1}]
        self.assertNotIn('jawOpen',audit(d,p)['missingFaceChannels'])
    def test_target_name_count_mismatch(self):
        d=fixture(); d['meshes'][0]['extras']['targetNames'].append('fake')
        self.assertTrue(any('targetNames length' in e for e in audit(d)['capabilityErrors']))
    def test_skin_attributes_required(self):
        d=fixture(); del d['meshes'][0]['primitives'][0]['attributes']['WEIGHTS_0']; self.assertTrue(any('WEIGHTS_0' in e for e in audit(d)['capabilityErrors']))
    def test_cycle_does_not_hang(self):
        d=fixture(); d['nodes'][2]['children']=[0]; self.assertTrue(any('Cycle' in e for e in audit(d)['capabilityErrors']))
    def test_external_files_reported_not_fetched(self):
        d=fixture(); d['images']=[{'uri':'https://example.invalid/private.png'}]; self.assertEqual(len(audit(d)['externalResources']),1)
    def test_decoder_hints(self):
        d=fixture(); d['extensionsRequired']=['KHR_texture_basisu','KHR_draco_mesh_compression']; self.assertEqual(set(audit(d)['decoderHints']),{'Draco','KTX2/Basis'})
    def test_bone_only_face_not_falsely_validated(self):
        p=profile(); p['face']['driver']='bones'; self.assertEqual(audit(fixture(),p)['status'],'needs-attention')
    def test_triangle_metadata_counts(self): self.assertEqual(audit(fixture())['meshGeometryCounts']['triangles'],1)
    def test_report_does_not_change_input(self):
        d=fixture(); before=copy.deepcopy(d); audit(d); self.assertEqual(d,before)
    def test_cli_success_and_safe_output(self):
        with tempfile.TemporaryDirectory() as temp:
            path=Path(temp)/'synthetic.glb'; path.write_bytes(glb(fixture())); out=Path(temp)/'report.json'
            r=subprocess.run([sys.executable,str(ROOT/'scripts/inspect_glb.py'),str(path),'--strict','--out',str(out)],capture_output=True,text=True)
            self.assertEqual(r.returncode,0,r.stderr); self.assertEqual(read_json(out)['sha256'],hashlib.sha256(path.read_bytes()).hexdigest())
            bad=subprocess.run([sys.executable,str(ROOT/'scripts/inspect_glb.py'),str(path),'--out',str(path)],capture_output=True,text=True)
            self.assertEqual(bad.returncode,1); parse_glb(path.read_bytes())
    def test_cli_strict_missing_capability_exit(self):
        with tempfile.TemporaryDirectory() as temp:
            path=Path(temp)/'empty.glb'; path.write_bytes(glb({'asset':{'version':'2.0'}}))
            r=subprocess.run([sys.executable,str(ROOT/'scripts/inspect_glb.py'),str(path),'--strict'],capture_output=True,text=True)
            self.assertEqual(r.returncode,2); self.assertEqual(json.loads(r.stdout)['status'],'needs-attention')
    def test_source_snapshot_integrity(self):
        m=read_json(ROOT/'references/source-snapshot-manifest.json')
        for f in m['files']:
            b=(ROOT/'assets/reference-project'/f['path']).read_bytes()
            self.assertEqual(hashlib.sha256(b).hexdigest(),f['sha256'],f['path'])

if __name__=='__main__': unittest.main()

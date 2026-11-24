#!/usr/bin/env python3
"""Read-only GLB v2 metadata/capability audit. Python 3.10+, no dependencies.

Never downloads, runs or modifies a model. This is NOT a complete glTF
validator, skin-weight inspector, texture decoder, renderer or license checker.
--strict fails on the selected profile's metadata capability errors.
"""
from __future__ import annotations
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import re
import struct
import sys
from typing import Any
from validate_profile import read_json, validate, reject_constant

JSON_CHUNK = 0x4E4F534A
BIN_CHUNK = 0x004E4942
SKILL = Path(__file__).resolve().parents[1]
ALIASES = {
    'hips':['hips','pelvis'], 'spine':['spine'], 'chest':['chest','spine2','upperchest'],
    'neck':['neck'], 'head':['head'], 'jaw':['jaw'],
    'leftShoulder':['leftshoulder','lclavicle'], 'rightShoulder':['rightshoulder','rclavicle'],
    'leftUpperArm':['leftarm','leftupperarm','lupperarm'], 'rightUpperArm':['rightarm','rightupperarm','rupperarm'],
    'leftLowerArm':['leftforearm','leftlowerarm','lforearm'], 'rightLowerArm':['rightforearm','rightlowerarm','rforearm'],
    'leftHand':['lefthand','lhand'], 'rightHand':['righthand','rhand'],
    'leftUpperLeg':['leftupleg','leftupperleg','lthigh'], 'rightUpperLeg':['rightupleg','rightupperleg','rthigh'],
    'leftLowerLeg':['leftleg','leftlowerleg','lcalf'], 'rightLowerLeg':['rightleg','rightlowerleg','rcalf'],
    'leftFoot':['leftfoot','lfoot'], 'rightFoot':['rightfoot','rfoot'],
    'leftToes':['lefttoebase','lefttoes'], 'rightToes':['righttoebase','righttoes'],
    'leftEye':['lefteye','eyeleft','eyel'], 'rightEye':['righteye','eyeright','eyer'],
}

def norm_bone(name: str) -> str:
    name = re.split(r'[|:]', name)[-1].lower()
    name = re.sub(r'[^a-z0-9]', '', name)
    return re.sub(r'^(mixamorig|ccbase|bip001|armature)', '', name)

def norm_shape(name: str) -> str:
    name = re.sub(r'^.*(?:blendshape[.:]|blendshapes[.:])', '', name, flags=re.I)
    return re.sub(r'[^a-z0-9]', '', name.lower())

def parse_glb(data: bytes) -> dict:
    if len(data) < 20:
        raise ValueError('Truncated GLB: expected a header and JSON chunk')
    magic, version, length = struct.unpack_from('<III', data)
    if magic != 0x46546C67 or version != 2:
        raise ValueError('Expected binary glTF / GLB version 2')
    if length != len(data):
        raise ValueError('GLB declared length does not match actual file length')
    pos, document, bin_length, count, seen_bin = 12, None, 0, 0, False
    while pos < length:
        if pos + 8 > length:
            raise ValueError('Truncated GLB chunk header')
        size, kind = struct.unpack_from('<II', data, pos)
        pos += 8
        if size % 4 or pos + size > length:
            raise ValueError('Misaligned or truncated GLB chunk')
        chunk = data[pos:pos+size]
        if count == 0 and kind != JSON_CHUNK:
            raise ValueError('The first GLB chunk must be JSON')
        if kind == JSON_CHUNK:
            if document is not None:
                raise ValueError('Duplicate GLB JSON chunk')
            document = json.loads(chunk.decode('utf-8').rstrip(' '), parse_constant=reject_constant)
        elif kind == BIN_CHUNK:
            if seen_bin or count != 1:
                raise ValueError('Duplicate or misplaced GLB binary chunk')
            seen_bin, bin_length = True, size
        pos += size
        count += 1
    if not isinstance(document, dict) or document.get('asset', {}).get('version') != '2.0':
        raise ValueError('Missing glTF 2.0 asset metadata')
    return {'json': document, 'binBytes': bin_length, 'chunkCount': count}

def index_ok(value: Any, values: list) -> bool:
    return isinstance(value, int) and not isinstance(value, bool) and 0 <= value < len(values)

def audit(document: dict, profile: dict | None = None) -> dict:
    if profile is None:
        profile = read_json(SKILL/'assets/avatar-profile.template.json')
    nodes, meshes = document.get('nodes', []), document.get('meshes', [])
    skins, accessors = document.get('skins', []), document.get('accessors', [])
    errors, warnings, parents, joint_ids = [], [], {}, set()
    for i, node in enumerate(nodes):
        for child in node.get('children', []):
            if not index_ok(child, nodes):
                errors.append(f'Node {i} has invalid child {child!r}')
            elif child in parents:
                errors.append(f'Node {child} has multiple parent references')
            else:
                parents[child] = i
        if 'mesh' in node and not index_ok(node['mesh'], meshes):
            errors.append(f'Node {i} has invalid mesh reference')
        if 'skin' in node and not index_ok(node['skin'], skins):
            errors.append(f'Node {i} has invalid skin reference')
    for i in range(len(nodes)):
        seen, cur = set(), i
        while cur in parents:
            if cur in seen:
                errors.append(f'Cycle in node hierarchy at {i}')
                break
            seen.add(cur); cur = parents[cur]
    for si, skin in enumerate(skins):
        for j in skin.get('joints', []):
            if index_ok(j, nodes):
                joint_ids.add(j)
            else:
                errors.append(f'Skin {si} has invalid joint {j!r}')
    if not joint_ids:
        errors.append('No valid skin joints: full-body skeletal animation not established')
    def ancestors(i: int) -> set[int]:
        result = set()
        while i in parents and parents[i] not in result:
            i = parents[i]; result.add(i)
        return result
    skeleton_nodes = set(joint_ids)
    for i in joint_ids:
        skeleton_nodes.update(ancestors(i))
    mapping, ambiguous = {}, {}
    roles = list(dict.fromkeys(profile['rig']['requiredRoles'] + list(profile['rig']['bones'])))
    for role in roles:
        explicit = profile['rig']['bones'].get(role)
        if isinstance(explicit, int) and not isinstance(explicit, bool):
            matches = [explicit] if explicit in skeleton_nodes else []
        elif isinstance(explicit, str):
            matches = [i for i in skeleton_nodes if nodes[i].get('name') == explicit]
        else:
            aliases = ALIASES.get(role, [norm_bone(role)])
            matches = [i for i in skeleton_nodes if norm_bone(nodes[i].get('name', '')) in aliases]
        if len(matches) == 1:
            mapping[role] = {'nodeIndex': matches[0], 'name': nodes[matches[0]].get('name', ''), 'explicit': explicit is not None}
        elif len(matches) > 1:
            ambiguous[role] = sorted(matches)
    missing_bones = [r for r in profile['rig']['requiredRoles'] if r not in mapping]
    if missing_bones:
        errors.append('Missing or ambiguous required bone roles: '+', '.join(missing_bones))
    if ambiguous:
        errors.append('Ambiguous normalized/exact bone mapping; use unique node indices')
    used = Counter(x['nodeIndex'] for x in mapping.values())
    if any(v > 1 for v in used.values()):
        errors.append('Multiple semantic bone roles map to the same node')
    for a, b in [('hips','spine'),('spine','head')]+[(f'{s}{a}',f'{s}{b}') for s in ['left','right'] for a,b in [('UpperLeg','LowerLeg'),('LowerLeg','Foot'),('UpperArm','LowerArm'),('LowerArm','Hand')]]:
        if a in mapping and b in mapping and mapping[a]['nodeIndex'] not in ancestors(mapping[b]['nodeIndex']):
            errors.append(f'Semantic hierarchy mismatch: {b} is not a descendant of {a}')
    mesh_reports, named = [], {}
    vertices, triangles = 0, 0
    skinned_mesh_ids = {n['mesh'] for n in nodes if 'skin' in n and index_ok(n.get('mesh'), meshes)}
    for mi, mesh in enumerate(meshes):
        names = mesh.get('extras', {}).get('targetNames', [])
        if not isinstance(names, list) or not all(isinstance(n,str) for n in names):
            warnings.append(f'Mesh {mi}: unusable targetNames metadata'); names = []
        counts, primitives = [], []
        for pi, primitive in enumerate(mesh.get('primitives', [])):
            attrs = primitive.get('attributes', {})
            for role, ref in attrs.items():
                if not index_ok(ref, accessors): errors.append(f'Mesh {mi}/{pi}: invalid {role} accessor')
            pa = accessors[attrs['POSITION']] if index_ok(attrs.get('POSITION'), accessors) else {}
            v = pa.get('count', 0); vertices += v if isinstance(v,int) else 0
            indices = primitive.get('indices')
            if indices is not None and not index_ok(indices, accessors):
                errors.append(f'Mesh {mi}/{pi}: invalid indices accessor')
            n = accessors[indices].get('count',0) if index_ok(indices, accessors) else v
            mode = primitive.get('mode',4)
            count = n//3 if mode == 4 else max(0,n-2) if mode in (5,6) else 0
            triangles += count
            targets=primitive.get('targets',[]); counts.append(len(targets))
            for target in targets:
                for channel, ref in target.items():
                    if not index_ok(ref, accessors): errors.append(f'Mesh {mi}/{pi}: invalid morph accessor {channel}')
            if mi in skinned_mesh_ids and not all(k in attrs for k in ('JOINTS_0','WEIGHTS_0')):
                errors.append(f'Mesh {mi}/{pi}: skinned node lacks JOINTS_0 or WEIGHTS_0 metadata')
            primitives.append({'index':pi,'vertices':v,'triangles':count,'morphCount':len(targets),'mode':mode})
        target_count = min(counts) if counts else 0
        if len(set(counts)) > 1: errors.append(f'Mesh {mi}: inconsistent morph counts across primitives')
        if names and len(names) != target_count:
            errors.append(f'Mesh {mi}: targetNames length differs from morph count')
        for ti, name in enumerate(names[:target_count]):
            named.setdefault(norm_shape(name), []).append({'meshIndex':mi,'targetIndex':ti,'name':name})
        duplicate_names=[k for k,v in Counter(norm_shape(n) for n in names[:target_count]).items() if v>1]
        if duplicate_names: errors.append(f'Mesh {mi}: ambiguous normalized morph names: {duplicate_names}')
        if target_count and not names:
            warnings.append(f'Mesh {mi}: unnamed targets; use verified index bindings')
        mesh_reports.append({'index':mi,'name':mesh.get('name',''),'targetCount':target_count,'targetNames':names,'primitives':primitives})
    def resolve_bindings(channel: str) -> list[dict]:
        explicit = profile['face']['bindings'].get(channel)
        if explicit is None:
            return named.get(norm_shape(channel), [])
        found=[]
        for binding in explicit:
            selector=binding['mesh']
            ids=[selector] if isinstance(selector,int) and not isinstance(selector,bool) and index_ok(selector,meshes) else [i for i,m in enumerate(meshes) if m.get('name') == selector] if isinstance(selector,str) else []
            if len(ids)!=1:
                errors.append(f'{channel}: mesh binding missing or ambiguous'); continue
            mi=ids[0]; report=mesh_reports[mi]; target=binding['target']
            tids=[target] if isinstance(target,int) and not isinstance(target,bool) and 0<=target<report['targetCount'] else [i for i,n in enumerate(report['targetNames'][:report['targetCount']]) if n==target] if isinstance(target,str) else []
            if len(tids)!=1:
                errors.append(f'{channel}: target binding missing or ambiguous'); continue
            found.append({'meshIndex':mi,'targetIndex':tids[0],'name':report['targetNames'][tids[0]] if report['targetNames'] else None})
        return found
    face_mapping={channel:resolve_bindings(channel) for channel in dict.fromkeys(profile['face']['requiredChannels']+list(profile['face']['bindings']))}
    missing_face=[c for c in profile['face']['requiredChannels'] if not face_mapping.get(c)]
    if profile['face']['driver'] != 'morph':
        errors.append('Bone/hybrid face is not validated by this morph-only metadata inspector; perform a runtime adapter audit')
    elif missing_face:
        errors.append('Missing required named/indexed face channels: '+', '.join(missing_face))
    uris=[]
    for group in ('buffers','images'):
        for i,item in enumerate(document.get(group,[])):
            uri=item.get('uri')
            if isinstance(uri,str) and not uri.startswith('data:'):
                uris.append({'kind':group,'index':i,'uri':uri})
    if uris: warnings.append('External resource references found; these files are not fetched or checked')
    extensions=sorted(set(document.get('extensionsUsed',[])+document.get('extensionsRequired',[])))
    decoders=[]
    for ext, decoder in [('KHR_draco_mesh_compression','Draco'),('EXT_meshopt_compression','Meshopt'),('KHR_meshopt_compression','Meshopt (verify engine support)'),('KHR_texture_basisu','KTX2/Basis')]:
        if ext in extensions: decoders.append(decoder)
    animations=[{'name':a.get('name',f'animation-{i}'),'channels':len(a.get('channels',[])),'interpolation':sorted(set(s.get('interpolation','LINEAR') for s in a.get('samplers',[])))} for i,a in enumerate(document.get('animations',[]))]
    warnings.append('Metadata presence is not deformation correctness. No binary accessor values, textures, permissions or rendering were validated.')
    return {'scope':'metadata-and-selected-profile-capabilities','status':'needs-attention' if errors else 'metadata-checks-passed',
            'nodes':len(nodes),'skins':len(skins),'uniqueJointCount':len(joint_ids),'boneMapping':mapping,'missingBones':missing_bones,'ambiguousBones':ambiguous,
            'meshGeometryCounts':{'vertices':vertices,'triangles':triangles,'note':'Accessor-derived totals per mesh primitive, not render draw-call counts or de-duplicated unique vertices.'},
            'meshes':mesh_reports,'faceMapping':face_mapping,'missingFaceChannels':missing_face,'animations':animations,
            'extensions':extensions,'requiredExtensions':document.get('extensionsRequired',[]),'decoderHints':decoders,'externalResources':uris,
            'capabilityErrors':list(dict.fromkeys(errors)),'warnings':list(dict.fromkeys(warnings)),
            'unverified':['full glTF validation','binary skin weights and inverse binds','actual morph deltas','texture quality','visual retargeting','facial realism','asset rights','runtime performance']}

def main() -> int:
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('model',type=Path); p.add_argument('--profile',type=Path); p.add_argument('--out',type=Path)
    p.add_argument('--strict',action='store_true'); p.add_argument('--max-mib',type=int,default=256)
    args=p.parse_args()
    try:
        if args.max_mib<=0 or args.model.stat().st_size>args.max_mib*1024*1024:
            raise ValueError('Input exceeds max-mib safety limit (or the limit is invalid)')
        if args.out and args.out.resolve() in {args.model.resolve(),args.profile.resolve() if args.profile else None}:
            raise ValueError('Output must not overwrite the model or profile')
        data=args.model.read_bytes(); glb=parse_glb(data)
        profile=read_json(args.profile) if args.profile else read_json(SKILL/'assets/avatar-profile.template.json')
        validated=validate(profile)
        if validated['status']!='pass': raise ValueError('Invalid profile: '+'; '.join(validated['errors']))
        result=audit(glb['json'],profile)
        result.update({'file':args.model.name,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'binaryChunkBytes':glb['binBytes']})
        text=json.dumps(result,ensure_ascii=False,indent=2)+'\n'
        if args.out:
            args.out.parent.mkdir(parents=True,exist_ok=True); args.out.write_text(text,encoding='utf-8')
        print(text,end='')
        return 2 if args.strict and result['capabilityErrors'] else 0
    except (OSError,ValueError,TypeError,KeyError,IndexError,AttributeError,RecursionError,struct.error) as exc:
        print(json.dumps({'status':'error','message':str(exc)},ensure_ascii=False),file=sys.stderr)
        return 1

if __name__=='__main__':
    sys.exit(main())

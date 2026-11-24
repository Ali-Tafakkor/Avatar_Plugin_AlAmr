"""Profile/metadata gates, not visual model tests."""
import copy
import unittest
from test_tools import profile, fixture
from validate_profile import validate
from inspect_glb import audit

class CalibrationProfileTests(unittest.TestCase):
    def test_new_draft_keeps_appearance_and_calibration_unresolved(self):
        p=profile()
        self.assertIsNone(p['appearance']['style'])
        self.assertIsNone(p['contact']['feet']['left']['mesh'])
        self.assertIsNone(p['posture']['hands']['right']['palmFrame'])
        self.assertEqual(validate(p)['status'],'pass')
    def test_two_different_appearance_briefs_have_same_runtime_contract(self):
        for description,clothing in [('short stylized elder','coat and boots'),('tall athletic woman','formal clothing and high heels')]:
            p=profile();p['appearance']['description']=description;p['appearance']['clothing']=clothing
            self.assertEqual(validate(p)['status'],'pass')
            self.assertEqual(p['face']['defaultEmotion'],'neutral')
    def test_negative_shoe_limit_fails(self):
        p=profile();p['contact']['feet']['left']['maxVerticalCorrectionMeters']=-1
        self.assertEqual(validate(p)['status'],'fail')
    def test_shared_heel_forefoot_patch_fails(self):
        p=profile();p['contact']['feet']['left']['heelVertices']=[1];p['contact']['feet']['left']['forefootVertices']=[1]
        self.assertEqual(validate(p)['status'],'fail')
    def test_airborne_pin_policy_is_not_allowed(self):
        p=profile();p['contact']['airbornePolicy']='pin'
        self.assertEqual(validate(p)['status'],'fail')
    def test_zero_palm_axis_fails(self):
        p=profile();p['posture']['hands']['left']['palmFrame']={'forward':[0,0,0],'radial':[1,0,0],'normal':[0,0,1]}
        self.assertEqual(validate(p)['status'],'fail')
    def test_nonorthogonal_palm_frame_fails(self):
        p=profile();p['posture']['hands']['left']['palmFrame']={'forward':[1,0,0],'radial':[1,0,0],'normal':[0,0,1]}
        self.assertEqual(validate(p)['status'],'fail')
    def test_offset_quaternion_length_and_norm_are_checked(self):
        for q in [[0,0,0,0],[0,0,0,1,1]]:
            p=profile();p['posture']['bodyOffsets']=[{'bone':'Head','deltaQuaternion':q}]
            self.assertEqual(validate(p)['status'],'fail')
    def test_duplicate_pose_owner_fails(self):
        p=profile();item={'bone':'Wrist','deltaQuaternion':[0,0,0,1]};p['posture']['hands']['left']['jointOffsets']=[item,copy.deepcopy(item)]
        self.assertEqual(validate(p)['status'],'fail')
    def test_required_five_fingers_cannot_pass_metadata_with_body_roles_alone(self):
        p=profile();p['posture']['requireFiveFingers']=True
        r=audit(fixture(),p)
        self.assertEqual(r['status'],'needs-attention')
        self.assertTrue(any('five-finger' in e for e in r['capabilityErrors']))
    def test_contact_vertex_outside_accessor_fails_metadata(self):
        p=profile();p['contact']['feet']['left'].update(mesh=0,heelVertices=[0],forefootVertices=[99])
        self.assertTrue(any('contact vertex' in e for e in audit(fixture(),p)['capabilityErrors']))
    def test_valid_contact_selectors_do_not_claim_grounded_geometry(self):
        p=profile();p['contact']['feet']['left'].update(mesh=0,heelVertices=[0],forefootVertices=[1])
        r=audit(fixture(),p)
        self.assertEqual(r['calibrationMetadata']['feet']['left']['groundContact'],'not-tested')
    def test_missing_required_motion_remains_unresolved(self):
        p=profile();p['motionRoles']['jump']['kind']='unsupported'
        r=validate(p,True)
        self.assertTrue(any('motionRoles.jump' in e for e in r['errors']))
    def test_mapped_fingers_require_skin_joint_ancestry(self):
        p=profile();p['posture']['hands']['left']['fingers']['index']=[2,0]
        self.assertTrue(any('invalid finger ancestry' in e for e in audit(fixture(),p)['capabilityErrors']))
    def test_reusing_two_bones_does_not_manufacture_five_digits(self):
        p=profile();p['posture']['hands']['left']['fingers']={d:[1,2] for d in ('thumb','index','middle','ring','little')}
        self.assertEqual(validate(p)['status'],'fail')
    def test_five_independent_declared_chains_pass_metadata_without_visual_claim(self):
        p=profile();doc=fixture();p['posture']['requireFiveFingers']=True
        for side in ('left','right'):
            hand=next(i for i,n in enumerate(doc['nodes']) if n.get('name')==side+'Hand')
            for digit in ('thumb','index','middle','ring','little'):
                parent=hand;chain=[]
                for segment in range(3):
                    index=len(doc['nodes']);doc['nodes'].append({'name':side+digit+str(segment)})
                    doc['nodes'][parent].setdefault('children',[]).append(index)
                    doc['skins'][0]['joints'].append(index);chain.append(index);parent=index
                p['posture']['hands'][side]['fingers'][digit]=chain
        r=audit(doc,p);self.assertEqual(r['status'],'metadata-checks-passed',r['capabilityErrors'])
        self.assertEqual(len(r['calibrationMetadata']['hands']['left']['declaredValidChains']),5)
        self.assertEqual(r['calibrationMetadata']['hands']['left']['naturalRestPose'],'not-tested')
    def test_explicit_resolved_configuration_can_pass_without_claiming_asset_existence(self):
        p=profile();p['id']='synthetic-configuration-only';p['assets']['model']='synthetic-not-an-asset.glb'
        p['normalization'].update(sourceForward='+Z',sourceUnitsToMeters=1)
        p['rig']['bones']={name:i for i,name in enumerate(p['rig']['requiredRoles'])}
        p['face']['gaze']['driver']='morph'
        p['face']['bindings']={name:[{'mesh':0,'target':i,'gain':1,'offset':0,'min':0,'max':1}] for i,name in enumerate(p['face']['requiredChannels'])}
        p['movement'].update(colliderRadiusMeters=0.2,colliderHeightMeters=1.5,stepHeightMeters=0.2)
        p['deployment'].update(commercialUse=False,threeVersion='0.185.1')
        p['quality'].update(targetDevice='synthetic test only',targetFps=60)
        for role in p['requiredMotionRoles']:p['motionRoles'][role].update(kind='native',source='synthetic',clip=role)
        p['contact'].update(supportProvider='synthetic-plane',gapToleranceMeters=0.002,penetrationToleranceMeters=0.001)
        p['posture']['referencePose']='synthetic-idle@0'
        for side in ('left','right'):
            p['contact']['feet'][side].update(mesh=0,heelVertices=[0],forefootVertices=[1],clearanceMeters=0,maxPitchRadians=0.2,maxVerticalCorrectionMeters=0.02)
            p['posture']['hands'][side]['palmFrame']={'forward':[0,1,0],'radial':[1,0,0],'normal':[0,0,1]}
        r=validate(p,True);self.assertEqual(r['status'],'pass',r['errors'])
        self.assertEqual(r['scope'],'resolved-configuration')
        self.assertTrue(any('does not verify files' in w for w in r['warnings']))

if __name__=='__main__':unittest.main()

#!/usr/bin/env python3
"""Validate this skill's profile, with Python 3.10+ standard library only.

This implements only the JSON Schema keywords used in the bundled schema,
not a general JSON Schema implementation. --resolved checks readiness of
configuration, not asset existence, rights, rendering or runtime integration.
"""
from __future__ import annotations
import argparse
import json
import math
from pathlib import Path
import sys
from typing import Any

SKILL = Path(__file__).resolve().parents[1]

def reject_constant(value: str) -> None:
    raise ValueError(f"Non-finite JSON number: {value}")

def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8-sig"), parse_constant=reject_constant)

def is_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)

def matches_type(value: Any, kind: str) -> bool:
    return {
        "null": lambda: value is None,
        "object": lambda: isinstance(value, dict),
        "array": lambda: isinstance(value, list),
        "string": lambda: isinstance(value, str),
        "boolean": lambda: isinstance(value, bool),
        "number": lambda: is_number(value),
        "integer": lambda: is_number(value) and int(value) == value,
    }[kind]()

def equal_json(a: Any, b: Any) -> bool:
    if isinstance(a, bool) != isinstance(b, bool):
        return False
    return a == b

def check_schema(value: Any, schema: dict, path: str = "$") -> list[str]:
    """Check the fixed subset used by assets/avatar-profile.schema.json."""
    errors: list[str] = []
    if "anyOf" in schema:
        if not any(not check_schema(value, branch, path) for branch in schema["anyOf"]):
            errors.append(f"{path}: does not match an allowed shape/type")
        return errors
    if "type" in schema:
        types = schema["type"] if isinstance(schema["type"], list) else [schema["type"]]
        if not any(matches_type(value, t) for t in types):
            return [f"{path}: expected {' or '.join(types)}"]
    if "const" in schema and not equal_json(value, schema["const"]):
        errors.append(f"{path}: must equal {schema['const']!r}")
    if "enum" in schema and not any(equal_json(value, allowed) for allowed in schema["enum"]):
        errors.append(f"{path}: not in allowed enum")
    if isinstance(value, dict):
        for key in schema.get("required", []):
            if key not in value:
                errors.append(f"{path}.{key}: required")
        properties = schema.get("properties", {})
        for key, item in value.items():
            if "propertyNames" in schema:
                errors.extend(check_schema(key, schema["propertyNames"], f"{path}.<key:{key}>"))
            if key in properties:
                errors.extend(check_schema(item, properties[key], f"{path}.{key}"))
            elif schema.get("additionalProperties") is False:
                errors.append(f"{path}.{key}: unknown property")
            elif isinstance(schema.get("additionalProperties"), dict):
                errors.extend(check_schema(item, schema["additionalProperties"], f"{path}.{key}"))
    if isinstance(value, list):
        if len(value) < schema.get("minItems", 0):
            errors.append(f"{path}: too few entries")
        if "maxItems" in schema and len(value) > schema["maxItems"]:
            errors.append(f"{path}: too many entries")
        if schema.get("uniqueItems"):
            if any(any(equal_json(x, y) for y in value[:i]) for i, x in enumerate(value)):
                errors.append(f"{path}: duplicate entries")
        if "items" in schema:
            for i, item in enumerate(value):
                errors.extend(check_schema(item, schema["items"], f"{path}[{i}]"))
    if isinstance(value, str) and len(value) < schema.get("minLength", 0):
        errors.append(f"{path}: string is too short")
    if is_number(value):
        for keyword, bad in (("minimum", lambda v, b: v < b), ("maximum", lambda v, b: v > b),
                             ("exclusiveMinimum", lambda v, b: v <= b), ("exclusiveMaximum", lambda v, b: v >= b)):
            if keyword in schema and bad(value, schema[keyword]):
                errors.append(f"{path}: violates {keyword} {schema[keyword]}")
    return errors

def validate(profile: Any, resolved: bool = False) -> dict:
    schema = read_json(SKILL / "assets/avatar-profile.schema.json")
    errors = check_schema(profile, schema)
    warnings: list[str] = []
    if errors:
        return {"status": "fail", "scope": "profile-structure", "errors": errors, "warnings": warnings}
    m, f, c = profile["movement"], profile["face"], profile["camera"]
    if m["runSpeedMps"] <= m["walkSpeedMps"]:
        errors.append("movement.runSpeedMps must exceed walkSpeedMps")
    if m["fixedStepSeconds"] > 1/30:
        warnings.append("Fixed simulation step exceeds 1/30 s; review controller stability.")
    if f["blink"]["waitMaxSeconds"] < f["blink"]["waitMinSeconds"]:
        errors.append("face.blink.waitMaxSeconds must be >= waitMinSeconds")
    if c["followFovDegrees"] + c["runFovAdditionDegrees"] >= 180:
        errors.append("Follow plus run FOV must stay below 180 degrees")
    for channel, bindings in f["bindings"].items():
        for i, binding in enumerate(bindings):
            if binding["min"] > binding["max"]:
                errors.append(f"face.bindings.{channel}[{i}]: min exceeds max")
    if m["colliderHeightMeters"] is not None and m["colliderRadiusMeters"] is not None:
        if m["colliderHeightMeters"] < 2*m["colliderRadiusMeters"]:
            errors.append("Collider height is less than its diameter; invalid for a capsule-style contract")
    unresolved = []
    for section, fields in {
        "assets": ["model"], "normalization": ["sourceForward", "sourceUnitsToMeters"],
        "movement": ["colliderRadiusMeters", "colliderHeightMeters", "stepHeightMeters"],
        "deployment": ["commercialUse", "threeVersion"], "quality": ["targetDevice", "targetFps"]
    }.items():
        for key in fields:
            if profile[section][key] is None:
                unresolved.append(f"{section}.{key}")
    if profile["id"].startswith("replace-"):
        unresolved.append("id")
    for name in profile["requiredMotionRoles"]:
        role = profile["motionRoles"].get(name)
        if role is None or role["kind"] in ("unsupported", "unresolved"):
            unresolved.append(f"motionRoles.{name}")
        elif role["kind"] in ("native", "retargeted") and (role["source"] is None or role["clip"] is None):
            unresolved.append(f"motionRoles.{name}.source/clip")
    contact, posture = profile["contact"], profile["posture"]
    if posture["requireFiveFingers"] and not posture["enabled"]:
        errors.append("posture: five-finger requirement conflicts with disabled posture audit")
    if contact["enabled"]:
        for key in ("supportProvider", "gapToleranceMeters", "penetrationToleranceMeters"):
            if contact[key] is None:
                unresolved.append("contact." + key)
        for side, foot in contact["feet"].items():
            prefix = "contact.feet." + side
            if foot["samplingMode"] == "vertices":
                for key in ("mesh", "heelVertices", "forefootVertices"):
                    if foot[key] is None or foot[key] == []:
                        unresolved.append(prefix + "." + key)
                if set(foot["heelVertices"]) & set(foot["forefootVertices"]):
                    errors.append(prefix + ": heel and forefoot patches must be distinct")
            elif foot["heelMarker"] is None or foot["forefootMarker"] is None:
                unresolved.append(prefix + ".markers")
            elif foot["heelMarker"] == foot["forefootMarker"]:
                errors.append(prefix + ": heel and forefoot markers must be distinct")
            for key in ("clearanceMeters", "maxPitchRadians", "maxVerticalCorrectionMeters"):
                if foot[key] is None:
                    unresolved.append(prefix + "." + key)
    if posture["enabled"]:
        if posture["referencePose"] is None:
            unresolved.append("posture.referencePose")
        offsets = [("posture.bodyOffsets", posture["bodyOffsets"])]
        for side, hand in posture["hands"].items():
            prefix = "posture.hands." + side
            offsets.append((prefix + ".jointOffsets", hand["jointOffsets"]))
            if not hand["enabled"]:
                if posture["requireFiveFingers"]:
                    errors.append(prefix + ": five-finger requirement conflicts with disabled hand")
                continue
            frame = hand["palmFrame"]
            if frame is None:
                unresolved.append(prefix + ".palmFrame")
            else:
                axes = list(frame.values())
                if any(abs(math.sqrt(sum(v*v for v in axis)) - 1) > 1e-4 for axis in axes):
                    errors.append(prefix + ": palm axes must be unit length")
                if any(abs(sum(a*b for a,b in zip(axes[i], axes[j]))) > 1e-4 for i in range(3) for j in range(i)):
                    errors.append(prefix + ": palm axes must be orthogonal")
            missing = [digit for digit in ("thumb", "index", "middle", "ring", "little") if digit not in hand["fingers"]]
            finger_joints = [joint for chain in hand["fingers"].values() for joint in chain]
            if len(set(finger_joints)) != len(finger_joints):
                errors.append(prefix + ": finger chains must use independent digit joints, excluding the shared hand root")
            if missing:
                warnings.append(prefix + ": finger chains unresolved/unsupported: " + ", ".join(missing))
                if posture["requireFiveFingers"]:
                    unresolved.extend(prefix + ".fingers." + digit for digit in missing)
        seen = set()
        for label, entries in offsets:
            for item in entries:
                if item["bone"] in seen:
                    errors.append(label + ": duplicate bone owner")
                seen.add(item["bone"])
                if abs(math.sqrt(sum(v*v for v in item["deltaQuaternion"])) - 1) > 1e-4:
                    errors.append(label + ": delta quaternion must be normalized")
    for role in profile["rig"]["requiredRoles"]:
        if role not in profile["rig"]["bones"]:
            unresolved.append(f"rig.bones.{role}")
    if f["gaze"]["enabled"] and f["gaze"]["driver"] == "inspect-asset":
        unresolved.append("face.gaze.driver")
    if resolved:
        errors.extend(f"Unresolved configuration: {key}" for key in unresolved)
        if f["driver"] in ("morph", "hybrid"):
            errors.extend(f"Missing explicit morph binding: {key}" for key in f["requiredChannels"] if key not in f["bindings"])
    elif unresolved:
        warnings.append("Draft contains unresolved fields; this is expected for the template: " + ", ".join(unresolved))
    warnings.append("This check does not verify files, facial geometry, implementation, permissions or performance.")
    return {"status": "fail" if errors else "pass", "scope": "resolved-configuration" if resolved else "draft-configuration",
            "errors": errors, "warnings": warnings}

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("profile", type=Path)
    parser.add_argument("--resolved", action="store_true", help="Require resolved configuration, not just a valid draft")
    args = parser.parse_args()
    try:
        result = validate(read_json(args.profile), args.resolved)
    except (OSError, ValueError, TypeError, RecursionError) as exc:
        result = {"status": "error", "errors": [str(exc)]}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result["status"] == "pass" else 2

if __name__ == "__main__":
    sys.exit(main())

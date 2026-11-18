/**
 * Utility functions for robust Group and Sub-Group matching and normalization.
 * Handles variations like "G1", "Group 1", "Group 1 (G1)", "G1A", "G1B", "G2", "G2A", "G2B".
 */

export interface NormalizedTarget {
  isMainGroup: boolean; // true if target is general G1 or G2
  mainGroup: 'G1' | 'G2' | string;
  subGroup: 'G1A' | 'G1B' | 'G2A' | 'G2B' | string;
  display: string;
}

export function normalizeTargetGroup(target: string | null | undefined): NormalizedTarget {
  if (!target || !target.trim()) {
    return { isMainGroup: false, mainGroup: '', subGroup: '', display: 'All Groups' };
  }

  const clean = target.toUpperCase().replace(/\s+|-|_/g, '');

  // 1. Check Sub-Groups (G1A, G1B, G2A, G2B)
  if (clean.includes('G1A') || clean.includes('GROUP1A')) {
    return { isMainGroup: false, mainGroup: 'G1', subGroup: 'G1A', display: 'Sub-Group G1A' };
  }
  if (clean.includes('G1B') || clean.includes('GROUP1B')) {
    return { isMainGroup: false, mainGroup: 'G1', subGroup: 'G1B', display: 'Sub-Group G1B' };
  }
  if (clean.includes('G2A') || clean.includes('GROUP2A')) {
    return { isMainGroup: false, mainGroup: 'G2', subGroup: 'G2A', display: 'Sub-Group G2A' };
  }
  if (clean.includes('G2B') || clean.includes('GROUP2B')) {
    return { isMainGroup: false, mainGroup: 'G2', subGroup: 'G2B', display: 'Sub-Group G2B' };
  }

  // 2. Check Main Groups (G1 / Group 1)
  if (clean.includes('G1') || clean.includes('GROUP1') || clean === '1') {
    return { isMainGroup: true, mainGroup: 'G1', subGroup: '', display: 'Group 1 (G1)' };
  }

  // 3. Check Main Groups (G2 / Group 2)
  if (clean.includes('G2') || clean.includes('GROUP2') || clean === '2') {
    return { isMainGroup: true, mainGroup: 'G2', subGroup: '', display: 'Group 2 (G2)' };
  }

  return { isMainGroup: false, mainGroup: clean, subGroup: '', display: target };
}

export interface StudentGroupInfo {
  mainGroup: string;
  subGroup: string;
  display: string;
}

export function getStudentGroupInfo(student: any): StudentGroupInfo {
  const sGroup = (student?.signup_info?.group || '').toUpperCase().replace(/\s+|-|_/g, '');
  const sSubGroup = (student?.signup_info?.sub_group || '').toUpperCase().replace(/\s+|-|_/g, '');
  const sSection = (student?.section || '').toUpperCase().replace(/\s+|-|_/g, '');

  let subGroup = '';
  // Check sub-groups from any field
  if (sSubGroup.includes('G1A') || sGroup.includes('G1A') || sSection.includes('G1A')) subGroup = 'G1A';
  else if (sSubGroup.includes('G1B') || sGroup.includes('G1B') || sSection.includes('G1B')) subGroup = 'G1B';
  else if (sSubGroup.includes('G2A') || sGroup.includes('G2A') || sSection.includes('G2A')) subGroup = 'G2A';
  else if (sSubGroup.includes('G2B') || sGroup.includes('G2B') || sSection.includes('G2B')) subGroup = 'G2B';

  let mainGroup = '';
  if (subGroup.startsWith('G1') || sGroup.includes('G1') || sGroup.includes('GROUP1') || sSection.includes('G1') || sSection.includes('GROUP1') || sGroup === '1') {
    mainGroup = 'G1';
  } else if (subGroup.startsWith('G2') || sGroup.includes('G2') || sGroup.includes('GROUP2') || sSection.includes('G2') || sSection.includes('GROUP2') || sGroup === '2') {
    mainGroup = 'G2';
  }

  const display = subGroup || mainGroup || student?.signup_info?.sub_group || student?.signup_info?.group || student?.section || 'None';
  return { mainGroup, subGroup, display };
}

/**
 * Checks if a student matches the class target group.
 * If target is "G1", both G1A and G1B students match.
 * If target is "G2", both G2A and G2B students match.
 * If target is specific like "G1A", only G1A students match.
 */
export function checkStudentGroupMatch(target: string | null | undefined, student: any): {
  match: boolean;
  targetDisplay: string;
  studentDisplay: string;
} {
  if (!target || !target.trim()) {
    return { match: true, targetDisplay: 'All Groups', studentDisplay: '' };
  }

  const normTarget = normalizeTargetGroup(target);
  const stu = getStudentGroupInfo(student);

  let match = false;
  if (normTarget.isMainGroup) {
    // Target is Group 1 -> G1, G1A, G1B all match
    // Target is Group 2 -> G2, G2A, G2B all match
    match = stu.mainGroup === normTarget.mainGroup;
  } else if (normTarget.subGroup) {
    // Specific sub-group target (e.g. G1A)
    match = stu.subGroup === normTarget.subGroup;
  } else {
    // Fallback: compare main group or exact string
    match = stu.mainGroup === normTarget.mainGroup || stu.display.toUpperCase().includes(normTarget.mainGroup);
  }

  return {
    match,
    targetDisplay: normTarget.display,
    studentDisplay: stu.display,
  };
}

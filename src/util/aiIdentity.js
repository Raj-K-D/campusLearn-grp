const CREATOR_QUESTION_PATTERNS = [
  /\bwho\b[^?!.]{0,35}\b(?:made|created|built|developed)\s+(?:the\s+)?(?:you|gooloogulu|campuslearn|(?:this|the)\s+(?:assistant|ai|bot|study buddy))\b/i,
  /\bwho\b[^?!.]{0,30}\byour\s+(?:owner|creator|founder|developer)\b/i,
  /\bwho\b[^?!.]{0,30}\b(?:owner|creator|founder|developer)\s+of\s+(?:you|gooloogulu|campuslearn|(?:this|the)\s+(?:assistant|ai|bot|study buddy))\b/i,
  /\bwho\b[^?!.]{0,30}\b(?:gooloogulu|campuslearn|(?:this|the)\s+(?:assistant|ai|bot|study buddy))['’]s\s+(?:owner|creator|founder|developer)\b/i,
];

export function getCreatorResponse(message) {
  if (!CREATOR_QUESTION_PATTERNS.some((pattern) => pattern.test(message))) {
    return null;
  }

  return 'I’m Gooloogulu, CampusLearn’s AI study assistant. I was created for CampusLearn by Rohit Lonkar and Raj Dugane.';
}

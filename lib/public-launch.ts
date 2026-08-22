export function isPublicLaunchEnabled() {
  return process.env.PLUMARELI_PUBLIC_LAUNCH === "true";
}

export function isPrivateBetaEnabled() {
  return !isPublicLaunchEnabled();
}

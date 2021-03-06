export { default as TablePaginationActions } from "./TablePaginationActions";
export { default as SunburstLoader } from "./SunburstLoader";
export { default as SunburstFormatter } from "./SunburstFormatter";
export { default as SkeletonLoader } from "./SkeletonLoader";
export { default as SkeletonFormatter } from "./SkeletonFormatter";
export { default as RoiInfoTip } from "./RoiInfoTip";

export function metaInfoError(error) {
  return {
    type: "META_INFO_ERROR",
    error
  };
}

export function sortRois(a, b) {
  const aStartsWithLetter = a.charAt(0).match(/[a-z]/i);
  const bStartsWithLetter = b.charAt(0).match(/[a-z]/i);
  if (aStartsWithLetter && !bStartsWithLetter) return -1;
  if (bStartsWithLetter && !aStartsWithLetter) return 1;
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

export function pickTextColorBasedOnBgColorAdvanced(bgColor, lightColor, darkColor) {
    const color = (bgColor.charAt(0) === '#') ? bgColor.substring(1, 7) : bgColor;
    const r = parseInt(color.substring(0, 2), 16); // hexToR
    const g = parseInt(color.substring(2, 4), 16); // hexToG
    const b = parseInt(color.substring(4, 6), 16); // hexToB
    const uicolors = [r / 255, g / 255, b / 255];
    const c = uicolors.map((col) => {
          if (col <= 0.03928) {
                  return col / 12.92;
                }
          return Math.pow((col + 0.055) / 1.055, 2.4);
        });
    const L = (0.2126 * c[0]) + (0.7152 * c[1]) + (0.0722 * c[2]);
    return (L > 0.179) ? darkColor : lightColor;
}

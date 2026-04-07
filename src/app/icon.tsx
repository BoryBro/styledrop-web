import { renderAppIcon } from "./_lib/app-icon";

export const size = {
  width: 512,
  height: 512,
};

export const contentType = "image/png";

export default async function Icon() {
  return renderAppIcon(size);
}

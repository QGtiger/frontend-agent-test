export const routeMap: Record<string, { default: any }> = import.meta.glob('@/pages/**/index.tsx', {
  eager: true,
});

export const layoutMap: Record<string, { default: any }> = import.meta.glob('@/pages/**/layout.tsx', {
  eager: true,
});

export const notFoundMap: Record<string, { default: any }> = import.meta.glob('@/pages/**/404.tsx', {
  eager: true,
});

export const settingsMap: Record<string, { default: PageSettings }> = import.meta.glob('@/pages/**/settings.tsx', {
  eager: true,
});

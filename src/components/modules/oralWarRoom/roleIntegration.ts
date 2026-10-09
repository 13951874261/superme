export function createSceneChangeIdleState() {
  return { isSceneChanging: false, sceneChangeStatus: '', sceneChangeError: '' } as const;
}

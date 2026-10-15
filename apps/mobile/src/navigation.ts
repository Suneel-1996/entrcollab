export type NavigationGuard = (proceed: () => void) => void;
export type RegisterGuard = (guard: NavigationGuard | null, busy?: boolean) => void;

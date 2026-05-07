export interface ScreenTimes {
    dispatchTime: number;
    lastInteractiveCall?: number;
}
export declare function setScreenDispatchTime(screenId: string, dispatchTime: number): void;
export declare function setScreenInteractiveTime(screenId: string, interactiveTime: number): void;
export declare function getScreenTimesFor(screenId: string): ScreenTimes | undefined;
//# sourceMappingURL=screenData.d.ts.map
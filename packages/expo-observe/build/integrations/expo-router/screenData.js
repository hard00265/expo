const screenData = {};
export function setScreenDispatchTime(screenId, dispatchTime) {
    screenData[screenId] = {
        ...screenData[screenId],
        dispatchTime,
    };
}
export function setScreenInteractiveTime(screenId, interactiveTime) {
    if (screenData[screenId]) {
        screenData[screenId] = {
            ...screenData[screenId],
            lastInteractiveCall: interactiveTime,
        };
    }
}
export function getScreenTimesFor(screenId) {
    return screenData[screenId];
}
//# sourceMappingURL=screenData.js.map
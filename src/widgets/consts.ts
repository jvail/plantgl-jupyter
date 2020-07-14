export const enum LsystemUnit {
    M = 0,
    DM = 1,
    CM = 2,
    MM = 3
}

export const SCALES: {[key:number]: number} = {
    [LsystemUnit.M]: 1,
    [LsystemUnit.DM]: 0.1,
    [LsystemUnit.CM]: 0.01,
    [LsystemUnit.MM]: 0.001
};
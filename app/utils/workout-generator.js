const addWorkoutEndpoint = 'https://connect.garmin.com/workout-service/workout';
const workoutUrl = 'https://connect.garmin.com/modern/workout/';

// TODO: workoutStep - category: "PUSH_UP" exerciseName: "PUSH_UP"

const sportTypeMapping = {
    running: { sportTypeId: 1, sportTypeKey: 'running', displayOrder: 1 },
    cycling: { sportTypeId: 2, sportTypeKey: 'cycling', displayOrder: 2 },
    swimming: { sportTypeId: 4, sportTypeKey: 'swimming', displayOrder: 5 },
    strength: { sportTypeId: 5, sportTypeKey: 'strength_training', displayOrder: 9 },
    cardio: { sportTypeId: 6, sportTypeKey: 'cardio_training', displayOrder: 8 },
    yoga: { sportTypeId: 7, sportTypeKey: 'yoga', displayOrder: 7 },
    pilates: { sportTypeId: 8, sportTypeKey: 'pilates', displayOrder: 8 },
    hiit: { sportTypeId: 9, sportTypeKey: 'hiit', displayOrder: 9 },
};

const stepTypeMapping = {
    warmup: { stepTypeId: 1, stepTypeKey: 'warmup', displayOrder: 1 },
    cooldown: { stepTypeId: 2, stepTypeKey: 'cooldown', displayOrder: 2 },
    interval: { stepTypeId: 3, stepTypeKey: 'interval', displayOrder: 3 },
    recovery: { stepTypeId: 4, stepTypeKey: 'recovery', displayOrder: 4 },
    rest: { stepTypeId: 5, stepTypeKey: 'rest', displayOrder: 5 },
    repeat: { stepTypeId: 6, stepTypeKey: 'repeat', displayOrder: 6 },
};

const targetTypeMapping = {
    'no target': { workoutTargetTypeId: 1, workoutTargetTypeKey: 'no.target', displayOrder: 1 },
    power: { workoutTargetTypeId: 2, workoutTargetTypeKey: 'power.zone', displayOrder: 2 },
    cadence: { workoutTargetTypeId: 3, workoutTargetTypeKey: 'cadence.zone', displayOrder: 3 },
    'heart rate': {
        workoutTargetTypeId: 4,
        workoutTargetTypeKey: 'heart.rate.zone',
        displayOrder: 4,
    },
    speed: { workoutTargetTypeId: 5, workoutTargetTypeKey: 'speed.zone', displayOrder: 5 },
    pace: { workoutTargetTypeId: 6, workoutTargetTypeKey: 'pace.zone', displayOrder: 6 },
};

const conditionTypeMapping = {
    calories: {
        conditionTypeId: 4,
        conditionTypeKey: 'calories',
        displayOrder: 4,
        displayable: true
    },
    distance: {
        conditionTypeId: 3,
        conditionTypeKey: 'distance',
        displayOrder: 3,
        displayable: true
    },
    'heart rate': {
        conditionTypeId: 6,
        conditionTypeKey: 'heart.rate',
        displayOrder: 6,
        displayable: true
    },
    'lap button': {
        conditionTypeId: 1,
        conditionTypeKey: 'lap.button',
        displayOrder: 1,
        displayable: true
    },
    iterations: {
        conditionTypeId: 7,
        conditionTypeKey: 'iterations',
        displayOrder: 7,
        displayable: false
    },
    power: {
        conditionTypeId: 5,
        conditionTypeKey: 'power',
        displayOrder: 5,
        displayable: true
    },
    time: {
        conditionTypeId: 2,
        conditionTypeKey: 'time',
        displayOrder: 2,
        displayable: true
    },
    'fixed rest': {
        conditionTypeId: 8,
        conditionTypeKey: 'fixed.rest',
        displayOrder: 8,
        displayable: true
    },
    'fixed repetition': {
        conditionTypeId: 9,
        conditionTypeKey: 'fixed.repetition',
        displayOrder: 9,
        displayable: true
    },
    reps: {
        conditionTypeId: 10,
        conditionTypeKey: 'reps',
        displayOrder: 10,
        displayable: true
    },
    'training peaks tss': {
        conditionTypeId: 11,
        conditionTypeKey: 'training.peaks.tss',
        displayOrder: 11,
        displayable: false
    },
    'repetition time': {
        conditionTypeId: 12,
        conditionTypeKey: 'repetition.time',
        displayOrder: 12,
        displayable: false
    },
    'time at valid cda': {
        conditionTypeId: 13,
        conditionTypeKey: 'time.at.valid.cda',
        displayOrder: 13,
        displayable: false
    },
    'power last lap': {
        conditionTypeId: 14,
        conditionTypeKey: 'power.last.lap',
        displayOrder: 14,
        displayable: false
    },
    'max power last lap': {
        conditionTypeId: 15,
        conditionTypeKey: 'max.power.last.lap',
        displayOrder: 15,
        displayable: false
    },
    'repetition swim css offset': {
        conditionTypeId: 16,
        conditionTypeKey: 'repetition.swim.css.offset',
        displayOrder: 16,
        displayable: true
    },
};

/**
 * Main function to create the workout payload.
 * @param {Object} workout - The workout object containing workout details and steps.
 * @returns {Object} - The formatted payload ready to be sent to Garmin.
 */
function convertWorkoutToGarmin(workout) {
    let stepOrder = 1;
    const sportType = getSportType(workout.type);
    const payload = {
        // Garmin data
        sportType: sportType,
        subSportType: null,
        workoutName: workout.name,
        estimatedDistanceUnit: {
            unitKey: null,
        },
        workoutSegments: [],
        avgTrainingSpeed: null,
        estimatedDurationInSecs: 0,
        estimatedDistanceInMeters: 0,
        estimateType: null,
        // Additional data
        dayOfWeek: workout.dayOfWeek,
        justification: workout.justification,
    };

    const segment = {
        segmentOrder: 1,
        sportType: sportType,
        workoutSteps: [],
    };

    const result = processSteps(workout.steps, stepOrder);
    segment.workoutSteps = result.steps;
    stepOrder = result.stepOrder;

    payload.workoutSegments.push(segment);
    payload.estimatedDurationInSecs = calculateEstimatedDuration(payload.workoutSegments);

    return payload;
}

/**
 * Retrieves the sport type object from the mapping.
 * @param {string} sportTypeKey - The sport type key (e.g., 'running').
 * @returns {Object} - The sport type object.
 */
function getSportType(sportTypeKey) {
    const sportType = sportTypeMapping[sportTypeKey.toLowerCase()];
    if (!sportType) {
        throw new Error(`Unsupported sport type: ${sportTypeKey}`);
    }
    return sportType;
}

/**
 * Recursively processes an array of steps.
 * @param {Array} stepsArray - The array of steps to process.
 * @param {number} stepOrder - The current step order.
 * @returns {Object} - An object containing the array of formatted steps and updated stepOrder.
 */
function processSteps(stepsArray, stepOrder) {
    const steps = [];

    stepsArray.forEach((step) => {
        const result = processStep(step, stepOrder);
        steps.push(result.step);
        stepOrder = result.stepOrder;
    });

    return { steps, stepOrder };
}

/**
 * Processes an individual step (regular or repeat).
 * @param {Object} step - The step object to process.
 * @param {number} stepOrder - The current step order.
 * @returns {Object} - An object containing the formatted step and updated stepOrder.
 */
function processStep(step, stepOrder) {
    if (!step.stepType) {
        throw new Error(`Missing stepType for step: ${step.stepName || 'Unnamed Step'}`);
    }

    const stepTypeKey = step.stepType.toLowerCase();

    if (stepTypeKey === 'repeat') {
        return processRepeatStep(step, stepOrder);
    } else {
        return processRegularStep(step, stepOrder);
    }
}

/**
 * Processes a regular executable step.
 * @param {Object} step - The step object to process.
 * @param {number} stepOrder - The current step order.
 * @returns {Object} - An object containing the formatted executable step and updated stepOrder.
 */
function processRegularStep(step, stepOrder) {
    const stepType = stepTypeMapping[step.stepType.toLowerCase()] || stepTypeMapping['interval'];

    // if (typeof step.stepDuration !== 'number' || step.stepDuration <= 0) {
    //     throw new Error(`Invalid or missing stepDuration for step: ${step.stepName || 'Unnamed Step'}`);
    // }

    const workoutStep = {
        stepId: stepOrder,
        stepOrder: stepOrder,
        stepType: stepType,
        type: 'ExecutableStepDTO',
        category: step.category,
        exerciseName: step.exerciseName,
        endCondition: {
            conditionTypeId: conditionTypeMapping[step.endCondition].conditionTypeId,
            conditionTypeKey: conditionTypeMapping[step.endCondition].conditionTypeKey,
            displayOrder: conditionTypeMapping[step.endCondition].displayOrder,
            displayable: true,
        },
        endConditionValue: step.endConditionValue,
        description: step.stepDescription || '',
        stepAudioNote: null,
    };

    if (step.target) {
        processTarget(workoutStep, step);
    } else {
        workoutStep.targetType = targetTypeMapping['no target'];
    }

    stepOrder += 1;
    return { step: workoutStep, stepOrder };
}

/**
 * Processes a repeat step and its child steps.
 * @param {Object} step - The repeat step object to process.
 * @param {number} stepOrder - The current step order.
 * @returns {Object} - An object containing the formatted repeat step and updated stepOrder.
 */
function processRepeatStep(step, stepOrder) {
    if (typeof step.numberOfIterations !== 'number' || step.numberOfIterations <= 0) {
        throw new Error(`Invalid or missing numberOfIterations for repeat step.`);
    }

    const repeatStep = {
        stepId: stepOrder,
        stepOrder: stepOrder,
        stepType: stepTypeMapping['repeat'],
        numberOfIterations: step.numberOfIterations || 1,
        smartRepeat: false,
        endCondition: {
            conditionTypeId: 7,
            conditionTypeKey: 'iterations',
            displayOrder: 7,
            displayable: false,
        },
        type: 'RepeatGroupDTO',
    };

    stepOrder += 1;

    // Recursively process child steps
    const result = processSteps(step.steps, stepOrder);
    repeatStep.workoutSteps = result.steps;
    stepOrder = result.stepOrder;

    return { step: repeatStep, stepOrder };
}

/**
 * Processes the target information for a workout step.
 * @param {Object} workoutStep - The workout step object to update.
 * @param {Object} step - The original step object containing target information.
 */
function processTarget(workoutStep, step) {
    const targetTypeKey = step.target.type.toLowerCase();
    const targetType = targetTypeMapping[targetTypeKey];

    if (!targetType) {
        throw new Error(`Unsupported target type: ${step.target.type}`);
    }

    workoutStep.targetType = targetType;

    if (step.target.value) {
        const { targetValueOne, targetValueTwo } = convertTargetValues(step, targetTypeKey);
        workoutStep.targetValueOne = targetValueOne;
        workoutStep.targetValueTwo = targetValueTwo;
    }
}

/**
 * Converts target values based on the target type and units.
 * @param {Object} step - The step object containing target values and units.
 * @param {string} targetTypeKey - The target type key (e.g., 'pace').
 * @returns {Object} - An object containing converted target values.
 */
function convertTargetValues(step, targetTypeKey) {
    const [minValue, maxValue] = Array.isArray(step.target.value)
        ? step.target.value
        : calculateValueRange(step.target.value, targetTypeKey);

    const lowerValue = minValue <= maxValue ? minValue : maxValue;
    const higherValue = minValue < maxValue ? maxValue : minValue;
    const targetValueOne = convertValueToUnit(lowerValue, step.target.unit);
    const targetValueTwo = convertValueToUnit(higherValue, step.target.unit);

    return { targetValueOne, targetValueTwo };
}

/**
 * Calculates the value range for a target based on the target type.
 * @param {number} value - The target value.
 * @param {string} targetTypeKey - The target type key (e.g., 'pace').
 * @returns {Array} - An array containing the min and max values for the target range.
 */
function calculateValueRange(value, targetTypeKey) {
    if (targetTypeKey === 'pace') {
        return calculatePaceRange(value);
    }
    return [value * 0.95, value * 1.05];
}

/**
 * Calculates the pace range based on the target pace.
 * @param {number} pace - The target pace in min/km.
 * @returns {Array} - An array containing the min and max pace values.
 */
function calculatePaceRange(pace) {
    const tenSecondsInMinutes = 10 / 60;

    const minPace = pace - tenSecondsInMinutes;
    const maxPace = pace + tenSecondsInMinutes;

    return [minPace, maxPace];
}

/**
 * Converts a value to a specific unit.
 * @param {number} value - The value to convert.
 * @param {string} unit - The unit to convert to.
 * @returns {number} - The converted value.
 */
function convertValueToUnit(value, unit) {
    switch (unit) {
        case 'min_per_km':
            return 1000 / (value * 60);
        default:
            return value;
    }
}

/**
 * Calculates the estimated duration of a workout based on its segments and steps.
 * @param {Array} workoutSegments - The array of workout segments to calculate the duration for.
 * @returns {number} - The estimated duration of the workout in seconds.
 */
function calculateEstimatedDuration(workoutSegments) {
    let duration = 0;
    workoutSegments.forEach((segment) => {
        segment.workoutSteps.forEach((step) => {
            if (step.type === 'ExecutableStepDTO') {
                duration += step.endConditionValue;
            } else if (step.type === 'RepeatGroupDTO') {
                duration += step.numberOfIterations * calculateEstimatedDuration([step]);
            }
        });
    });
    return duration;
}

function createWorkout(workout, callback) {
    let garminVersion = document.getElementById('garmin-connect-version');
    let xhr = new XMLHttpRequest();

    xhr.onreadystatechange = function () {
        if (this.readyState == 4 && this.status == 200) {
            callback(JSON.parse(xhr.response));
        }
    };

    let localStoredToken = window.localStorage.getItem('token');
    let accessTokenMap = JSON.parse(localStoredToken);
    let token = accessTokenMap.access_token;
    const payload = convertWorkoutToGarmin(workout);

    console.debug('[OGW] Payload:', JSON.stringify(payload));

    xhr.open('POST', addWorkoutEndpoint, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Accept', 'application/json, text/javascript, */*; q=0.01');

    xhr.setRequestHeader('x-app-ver', garminVersion.innerText || '4.27.1.0');
    xhr.setRequestHeader('x-requested-with', 'XMLHttpRequest');
    xhr.setRequestHeader('x-lang', 'it-IT');
    xhr.setRequestHeader('nk', 'NT');
    xhr.setRequestHeader('Di-Backend', 'connectapi.garmin.com');
    xhr.setRequestHeader('authorization', 'Bearer ' + token);
    xhr.withCredentials = true;

    xhr.send(JSON.stringify(payload));
}

function goToWorkout(id) {
    window.location.assign(workoutUrl + id);
}

module.exports = convertWorkoutToGarmin;

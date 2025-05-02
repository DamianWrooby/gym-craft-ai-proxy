const { z } = require('zod');

const EquipmentSchema = z.object({
    freeWeights: z.boolean(),
    trainingMachines: z.boolean(),
    treadmill: z.boolean(),
    rowingMachine: z.boolean(),
    stationaryBike: z.boolean(),
    elliptical: z.boolean(),
    stairMaster: z.boolean(),
    resistanceBands: z.boolean(),
    trx: z.boolean(),
    calisthenics: z.boolean(),
    mtbBike: z.boolean(),
    roadBike: z.boolean(),
});

const FitnessLevelSchema = z.object({
    fitnessLevel: z.number(),
    currentActivities: z.string(),
    physicalLimitations: z.string(),
});

const LifestyleSchema = z.object({
    job: z.string(),
    hourCapacity: z.string(),
    trainingDays: z.record(z.boolean()),
});

const ExperienceSchema = z.object({
    activityLevel: z.string(),
    activityHistory: z.string(),
    enjoyedExercises: z.string(),
    dislikedExercises: z.string(),
});

const GoalOptionsSchema = z.record(z.boolean());

const GoalsSchema = z.object({
    mainGoals: GoalOptionsSchema,
    otherGoalsDescription: z.string(),
});

const PersonalInfoSchema = z.object({
    sex: z.string(),
    age: z.number(),
    height: z.number(),
    weight: z.number(),
    medicalConditions: z.string(),
});

const SurveyFormSchema = z.object({
    personalInfo: PersonalInfoSchema,
    goals: GoalsSchema,
    experience: ExperienceSchema,
    lifestyle: LifestyleSchema,
    fitnessLevel: FitnessLevelSchema,
    equipment: EquipmentSchema,
});

module.exports = SurveyFormSchema;

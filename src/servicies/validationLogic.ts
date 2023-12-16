import { getWeather } from "../openWeather/openWeatherApi";
import {
  AgeRestriction,
  AndRestriction,
  DateRestriction,
  OrRestriction,
  Restriction,
  WeatherRestriction,
} from "../types/createCode";
import { CodeUsageArgs, EvaluationResult } from "../types/useCode";
import { isAfter, isBefore, isWithinInterval } from "date-fns";

let allReasons: string[] = [];

export const validateRestrictions = async (
  restrictions: Restriction[],
  requestArguments: CodeUsageArgs
): Promise<EvaluationResult> => {
  allReasons = [];

  const isValid = await globalRule(restrictions, requestArguments);

  if (isValid) {
    return { isValid };
  } else {
    return { isValid: false, reasons: allReasons };
  }
};

export async function globalRule(
  restriction: Restriction[],
  requestArguments: CodeUsageArgs
): Promise<boolean> {
  const results = await Promise.all(
    restriction.map((restriction) =>
      checkSingleRestriction(restriction, requestArguments)
    )
  );

  const isValid = results.every(Boolean);

  return isValid;
}

export const checkSingleRestriction = async (
  restriction: Restriction,
  requestArguments: CodeUsageArgs
): Promise<boolean> => {
  const restrictionKey = Object.keys(restriction)[0]; // Assuming there is only one key in restriction

  switch (restrictionKey) {
    case "@date":
      return dateRule(restriction as DateRestriction, requestArguments);
    case "@age":
      return ageRule(restriction as AgeRestriction, requestArguments);
    case "@meteo":
      return meteoRule(restriction as WeatherRestriction, requestArguments);
    case "@or":
      return orRule(restriction as OrRestriction, requestArguments);
    case "@and":
      return andRule(restriction as AndRestriction, requestArguments);
    default:
      return true;
  }
};

export function dateRule(
  restriction: DateRestriction,
  requestArguments: CodeUsageArgs
): boolean {
  const {
    "@date": { after, before },
  } = restriction;

  let afterDate: Date | null = null;
  let beforeDate: Date | null = null;

  if (after) {
    afterDate = new Date(after);
  }

  if (before) {
    beforeDate = new Date(before);
  }

  let rideDate: Date;
  if (!requestArguments.date) {
    rideDate = new Date();
  } else {
    rideDate = new Date(requestArguments.date);
  }

  let isValidDate: boolean;

  if (afterDate && beforeDate) {
    isValidDate = isWithinInterval(rideDate, {
      start: afterDate,
      end: beforeDate,
    });
  } else if (afterDate) {
    isValidDate = isAfter(rideDate, afterDate);
  } else if (beforeDate) {
    isValidDate = isBefore(rideDate, beforeDate);
  } else {
    isValidDate = true;
  }

  if (isValidDate) {
    return true;
  }

  allReasons.push("Invalid Date");
  return false;
}

export function ageRule(
  restriction: AgeRestriction,
  requestArguments: CodeUsageArgs
): boolean {
  const {
    "@age": { lt, eq, gt },
  } = restriction;

  if (!requestArguments.age) {
    allReasons.push("Missing age");
    return false;
  }
  if (eq && requestArguments.age !== eq) {
    allReasons.push("Invalid age EQ");
    return false;
  }
  if (lt && requestArguments.age >= lt) {
    allReasons.push("Invalid age lt");
    return false;
  }
  if (gt && requestArguments.age <= gt) {
    allReasons.push("Invalid age gt");
    return false;
  }
  return true;
}

export async function meteoRule(
  restriction: WeatherRestriction,
  requestArguments: CodeUsageArgs
): Promise<boolean> {
  const {
    "@meteo": { is, temp },
  } = restriction;

  if (!requestArguments.meteo?.town) {
    allReasons.push("No location specified");
    return false;
  }

  try {
    const weather = await getWeather(requestArguments.meteo.town);

    // Weather response: https://openweathermap.org/current#parameter
    // "is" possibilities : https://openweathermap.org/weather-conditions

    if (is && weather.weather[0].description !== is) {
      allReasons.push("Err weather is");
      return false;
    }

    if (temp) {
      if (temp.gt && weather.main.temp <= temp.gt) {
        allReasons.push("Err weather temp gt");
        return false;
      }
      if (temp.lt && weather.main.temp >= temp.lt) {
        allReasons.push("Err weather temp lt");
        return false;
      }
    }
    return true;
  } catch (error) {
    throw new Error(`${error}`);
  }
}

export async function andRule(
  andRestriction: AndRestriction,
  requestArguments: CodeUsageArgs
): Promise<boolean> {
  return await globalRule(andRestriction["@and"], requestArguments);
}

export async function orRule(
  orRestriction: OrRestriction,
  requestArguments: CodeUsageArgs
): Promise<boolean> {
  const results = await Promise.all(
    orRestriction["@or"].map((restriction) =>
      checkSingleRestriction(restriction, requestArguments)
    )
  );

  const isValid = results.some(Boolean);

  return isValid;
}
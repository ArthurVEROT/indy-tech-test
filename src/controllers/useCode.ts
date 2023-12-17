import { Request, Response } from "express";
import { promoCodes } from "../app";
import { ValidationResponse } from "../types/useCode";
import { validateRestrictions } from "../servicies/validationLogic";
import { ErrMessage } from "../errorHandling/errorMessages";

export const useCode = async (req: Request, res: Response) => {
  let response: ValidationResponse;
  const {
    name,
    arguments: { age, date, meteo },
  } = req.body;

  const promocode = promoCodes.find((code) => code.name === name);

  if (!promocode) throw new Error(ErrMessage.CODE.MISSING);

  try {
    const restrictionResponse = await validateRestrictions(
      promocode.restrictions,
      {
        age,
        date,
        meteo,
      }
    );
    if (!restrictionResponse.isValid) {
      response = {
        name,
        status: "denied",
        reasons: restrictionResponse.reasons,
      };

      return res.status(403).json(response);
    }
  } catch (error: unknown) {
    throw error;
  }

  response = {
    name,
    status: "accepted",
    avantage: { percent: promocode?.avantage.percent },
  };

  return res.status(200).json(response);
};

import { Request, Response } from 'express';
import { Database } from '../../database';
import { isUserAuthenticated, replaceSingleTickWithDoubleTick } from '../../util';
import { sendResponse, Status } from '../../util/log-response.util';

interface IRegistrationWelcomeQuiz {
	startAt: string;
	endAt: string;
	activePage: string;
	responses: {
		[questionId: string]: {
			response: string; // comma separated
		};
	};
}

export const saveRegistrationWelcomeQuizResponse_API = async (request: Request, response: Response) => {
	let hasError = false;
	function sendApiRes(code: number, description: string, result?: any) {
		const status = new Status();
		hasError = code !== 200;
		sendResponse({
			status: { ...status, code, description },
			result,
			response,
			request,
		});
	}

	const user = await isUserAuthenticated({ request }).catch((err) => {
		const { code, error } = err;
		sendApiRes(code, 'You must be logged in to continue...');
	});

	if (hasError) {
		return;
	}

	const { uid } = user || {};

	const quizData = request.body as IRegistrationWelcomeQuiz;

	const sql = `
  DELETE FROM v1.registration_welcome_quiz
  WHERE user_id = '${uid}';
  INSERT INTO v1.registration_welcome_quiz
  (completed_at, started_at, responses, user_id)
  VALUES
  ('${quizData.endAt}', '${quizData.startAt}', '${replaceSingleTickWithDoubleTick(
		JSON.stringify(quizData?.responses || {})
	)}', '${uid}' );
  `;
	await Database.query.none(sql);
	sendApiRes(200, '', null);
};

export const getUserRegistrationQuizResponseStatus_API = async (request: Request, response: Response) => {
	let hasError = false;
	function sendApiRes(code: number, description: string, result?: any) {
		const status = new Status();
		hasError = code !== 200;
		sendResponse({
			status: { ...status, code, description },
			result,
			response,
			request,
		});
	}

	const user = await isUserAuthenticated({ request }).catch((err) => {
		const { code, error } = err;
		sendApiRes(code, 'You must be logged in to continue...');
	});

	if (hasError) {
		return;
	}

	const { uid } = user || {};

	const sql = `
  SELECT 
  completed_at as "completedQuiz"
  FROM 
  v1.registration_welcome_quiz
  WHERE 
  user_id = '${uid}'
  `;

	const dbRes = await Database.query.oneOrNone(sql);

	sendApiRes(200, '', dbRes);
};
export const getUserRegistrationQuizResponse = async (uid: string): Promise<Array<string>> => {
	const sql = `
  select responses from v1.registration_welcome_quiz
  WHERE 
  user_id = '${uid}'
  `;
	const dbRes = await Database.query.oneOrNone(sql).catch((error) => {});

	let responsesList: Array<string> = [];
	if (!dbRes) {
		return responsesList;
	}
	let questionIdList = Object.keys(dbRes?.responses);
	questionIdList.forEach((questionId) => {
		responsesList.push(dbRes.responses[questionId].response);
	});
	return responsesList;
};

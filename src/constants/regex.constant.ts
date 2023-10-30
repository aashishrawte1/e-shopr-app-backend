export const YOUTUBE_VIDEO_ID_MATCHER_REGEX =
	/^.*(?:(?:youtu\.be\/|v\/|vi\/|u\/\w\/|embed\/)|(?:(?:watch)?\?v(?:i)?=|\&v(?:i)?=))([^#\&\?]*).*/;
export const EMAIL_REGEX =
	/^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
export const EMAIL =
	/^([\\w-]+(?:\\.[\\w-]+)*)@((?:[\\w-]+\\.)*\\w[\\w-]{0,66})\\.([a-zA-Z]{2,6}(?:\\.[a-zA-Z]{2})?)$/g;
export const NAME_REGEX = /^[a-zA-Z]+(([',. -][a-zA-Z ])?[a-zA-Z]*)*$/g;
export const MESSAGE_REGEX = /^[A-Za-z0-9 ,/\\-]+$/g;
export const NUMBER_REGEX = /^[0-9]+$/;
export const PHONE_NUMBER_REGEX = /^(\d{8})+/;

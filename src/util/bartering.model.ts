export interface IBarteringMessage {
	time: string;
	message: string;
	author: {
		uid: string;
		name: string;
	};
}

export interface IBarteringChatListItem {
	lastMessage: IBarteringMessage;
	members: {
		[key: string]: boolean;
	};
}

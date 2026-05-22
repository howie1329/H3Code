import Root from "./core/Root.svelte";
import Provider from "./core/Provider.svelte";
import Header from "./layout/Header.svelte";
import Body from "./layout/Body.svelte";
import Toolbar from "./layout/Toolbar.svelte";
import Tools from "./layout/Tools.svelte";
import Button from "./controls/Button.svelte";
import Textarea from "./controls/Textarea.svelte";
import Submit from "./controls/Submit.svelte";

export {
	Root,
	Provider,
	Header,
	Body,
	Toolbar,
	Tools,
	Button,
	Textarea,
	Submit,
	Root as PromptInput,
	Provider as PromptInputProvider,
	Header as PromptInputHeader,
	Body as PromptInputBody,
	Toolbar as PromptInputToolbar,
	Tools as PromptInputTools,
	Button as PromptInputButton,
	Textarea as PromptInputTextarea,
	Submit as PromptInputSubmit,
};

export {
	AttachmentsContext,
	getAttachmentsContext,
	setAttachmentsContext,
} from "./context/attachments.svelte.js";

export {
	Controller,
	TextController,
	Controller as PromptInputController,
	TextController as TextInputController,
	getPromptInputProvider,
	usePromptInput,
	setPromptInputProvider,
} from "./context/provider.svelte.js";

export type {
	PromptInputAttachment as PromptInputAttachmentData,
	PromptInputUploadStatus,
	FileWithId,
	Message,
	Message as PromptInputMessage,
	ChatStatus,
} from "./context/types.js";

export type { FileUIPart } from "ai";

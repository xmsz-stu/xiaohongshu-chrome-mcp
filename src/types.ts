export interface XhsNote {
    id?: string;
    noteId?: string;
    title?: string;
    [key: string]: unknown;
}

export interface SearchUpdatePayload {
    keyword: string;
    notes: XhsNote[];
}

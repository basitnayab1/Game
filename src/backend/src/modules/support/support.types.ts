export type TicketStatus="open"|"in_progress"|"waiting_for_user"|"resolved"|"closed"|"reopened";
export interface SupportTicket {
 id:string; userId:string; category:string; status:TicketStatus; subject:string; createdAt:Date;
}

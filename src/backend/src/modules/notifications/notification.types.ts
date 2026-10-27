export type NotificationCategory="all"|"transactions"|"promotions"|"security"|"system";
export interface NotificationRecord {
 id:string; userId:string; category:NotificationCategory;
 title:string; body:string; readAt?:Date; createdAt:Date;
}

export interface AgentAccount {
  id:string; userId:string;
  status:"pending"|"approved"|"suspended"|"rejected";
  commissionConfigId?:string;
}
export interface AgentCommission {
  id:string; agentId:string; status:"pending"|"approved"|"paid"|"reversed";
  amountMinor:bigint;
}

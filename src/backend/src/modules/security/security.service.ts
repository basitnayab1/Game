export function shouldReviewNewDevice(input:{known:boolean; riskScore:number}){
  return !input.known || input.riskScore >= 70;
}
/** Production risk scoring is a configurable server-side control. */

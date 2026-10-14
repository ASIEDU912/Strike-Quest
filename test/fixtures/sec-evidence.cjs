/* Entirely synthetic QA financial statements. Not Apple/SEC/market data. */
'use strict';
function fixture(){
 const raw={cik:1234,entityName:'SYNTHETIC QA INDUSTRIES — NOT MARKET DATA',facts:{'us-gaap':{}}};
 const add=(tag,values,instant=false)=>{raw.facts['us-gaap'][tag]={units:{USD:values.map((val,i)=>({...(instant?{}:{start:`${2023+i}-01-01`}),end:`${2023+i}-12-31`,filed:`${2024+i}-02-01`,form:'10-K',fp:'FY',fy:2023+i,accn:`0000001234-${24+i}-000001`,val}))}};};
 add('RevenueFromContractWithCustomerExcludingAssessedTax',[100000000,120000000,150000000]);add('NetIncomeLoss',[10000000,24000000,45000000]);add('NetCashProvidedByUsedInOperatingActivities',[20000000,35000000,60000000]);add('PaymentsToAcquirePropertyPlantAndEquipment',[5000000,10000000,15000000]);add('Assets',[500000000,600000000,700000000],true);add('Liabilities',[100000000,180000000,280000000],true);return raw;
}
module.exports=fixture;

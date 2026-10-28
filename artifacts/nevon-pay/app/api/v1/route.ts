import { z } from "zod";
import { db } from "@/lib/db";
import { json, requestId } from "@/lib/http";

const schema = z.object({name:z.string().min(2),email:z.string().email()});

export async function POST(req:Request){
  const rid=requestId(req);
  try{
    const data=schema.parse(await req.json());
    const merchant=await db.merchant.create({data});
    return json({success:true,merchant},201,rid);
  }catch(e:any){
    return json({success:false,error:{code:"VALIDATION_ERROR",message:e?.message||"Dados inválidos"}},400,rid);
  }
}

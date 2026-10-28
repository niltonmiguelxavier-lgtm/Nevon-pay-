import { db } from "@/lib/db";
import { json, requestId } from "@/lib/http";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const rid = requestId(req);
  const { id } = await params;
  const session = await db.checkoutSession.findUnique({where:{id}});
  if (!session) return json({success:false,error:{code:"NOT_FOUND",message:"Checkout não encontrado"}},404,rid);
  const updated = await db.checkoutSession.update({where:{id},data:{status:"CANCELLED"}});
  await db.payment.update({where:{id:session.paymentId},data:{status:"CANCELLED"}});
  return json({success:true,session:updated},200,rid);
}

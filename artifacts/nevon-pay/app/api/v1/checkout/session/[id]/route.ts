import { db } from "@/lib/db";
import { json, requestId } from "@/lib/http";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const rid = requestId(req);
  const { id } = await params;
  const session = await db.checkoutSession.findUnique({ where: { id } });
  if (!session) return json({success:false,error:{code:"NOT_FOUND",message:"Checkout não encontrado"}},404,rid);

  if (session.expiresAt < new Date() && session.status === "OPEN") {
    const updated = await db.checkoutSession.update({where:{id},data:{status:"EXPIRED"}});
    return json({success:true,session:updated},200,rid);
  }
  return json({success:true,session},200,rid);
}

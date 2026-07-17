import "dotenv/config";
import { prisma } from "../lib/prisma";

(async () => {
  const branch = await prisma.branch.findFirst({ where: { name: "Outlet Pusat" } });
  if (!branch) {
    console.log("Branch 'Outlet Pusat' not found");
    process.exit(1);
  }

  const updated = await prisma.branch.update({
    where: { id: branch.id },
    data: {
      slug: "outlet-pusat",
      pickupSlots: [
        { day: "MON", slots: ["09:00-11:00", "13:00-15:00", "17:00-19:00"] },
        { day: "TUE", slots: ["09:00-11:00", "13:00-15:00", "17:00-19:00"] },
        { day: "WED", slots: ["09:00-11:00", "13:00-15:00", "17:00-19:00"] },
        { day: "THU", slots: ["09:00-11:00", "13:00-15:00", "17:00-19:00"] },
        { day: "FRI", slots: ["09:00-11:00", "13:00-15:00", "17:00-19:00"] },
        { day: "SAT", slots: ["09:00-11:00", "13:00-15:00"] },
      ],
    },
  });
  console.log("Updated branch:", updated.id, "slug:", updated.slug);

  const existing = await prisma.pickupRequest.count({ where: { branchId: branch.id } });
  if (existing === 0) {
    await prisma.pickupRequest.create({
      data: {
        tenantId: branch.tenantId,
        branchId: branch.id,
        module: "LAUNDRY",
        customerName: "Budi Santoso",
        customerPhone: "+628123456789",
        latitude: -6.2088,
        longitude: 106.8456,
        addressText: "Jl. Sudirman No. 45, Jakarta Pusat",
        status: "PENDING",
        notes: "Pakaian kantor, sekitar 3kg",
      },
    });
    console.log("Seeded sample PENDING pickup request");
  } else {
    console.log("Pickup requests already exist:", existing);
  }

  await prisma.$disconnect();
})();

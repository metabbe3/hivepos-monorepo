import type { PickupRequestRepository, ListPickupRequestsQuery } from "../domain/repository.port";
import type { PickupRequestStatus, BusinessModule } from "../domain/types";
import type { ListPickupRequestsInput, PickupListDTO, PickupRequestDTO } from "./dto";
import { toPickupDTO } from "./mappers";
import type { RequestContext } from "./context";

const VALID_STATUSES: PickupRequestStatus[] = [
  "PENDING",
  "ACCEPTED",
  "SCHEDULED",
  "CONVERTED",
  "REJECTED",
  "CANCELED",
];

/** List pickup requests for the current branch context, with filters + pagination. */
export class ListPickupRequestsService {
  constructor(private pickupRepo: PickupRequestRepository) {}

  async execute(
    input: ListPickupRequestsInput,
    ctx: RequestContext,
  ): Promise<PickupListDTO> {
    const page = Math.max(1, parseInt(input.page ?? "1", 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(input.limit ?? "20", 10) || 20));

    const status: PickupRequestStatus | undefined =
      input.status && input.status !== "ALL" && VALID_STATUSES.includes(input.status)
        ? input.status
        : undefined;

    const query: ListPickupRequestsQuery = {
      branchIds: ctx.branchIds,
      module: ctx.activeModule as BusinessModule,
      ...(status ? { status } : {}),
      ...(input.search ? { search: input.search.trim() } : {}),
      page,
      limit,
    };

    const { items, total } = await this.pickupRepo.list(query);

    return {
      items: items.map(toPickupDTO) as PickupRequestDTO[],
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }
}

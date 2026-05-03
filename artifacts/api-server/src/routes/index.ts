import { Router, type IRouter } from "express";
import healthRouter from "./health";
import chatRouter from "./chat";
import inviteRouter from "./invite";
import youtubeRouter from "./youtube";

const router: IRouter = Router();

router.use(healthRouter);
router.use(chatRouter);
router.use(inviteRouter);
router.use(youtubeRouter);

export default router;

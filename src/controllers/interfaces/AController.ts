import {Request, Response} from "express";

export class AController {
    constructor() {
    }

    list(req: Request, res: Response) {
        res.status(501).send();
    }

    create(req: Request, res: Response) {
        res.status(501).send();
    }

    retrieve(req: Request, res: Response) {
        res.status(501).send();
    }

    update(req: Request, res: Response) {
        res.status(501).send();
    }

    destroy(req: Request, res: Response) {
        res.status(501).send();
    }
}
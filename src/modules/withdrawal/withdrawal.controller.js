import {
    createWithdrawal,
    getWithdrawal,
    getWithdrawals,
    cancelWithdrawal
} from "./withdrawal.service.js";


export const create = async (
    req,
    res,
    next
) => {

    try {

        const result =
            await createWithdrawal({

                userId:
                    req.user.id,

                amount:
                    req.body.amount,

                referenceId:
                    req.body.referenceId,

                metadata:
                    req.body.metadata
            });


        return res.status(201).json({

            success: true,

            data: result
        });

    } catch (error) {

        next(error);
    }
};


export const list = async (
    req,
    res,
    next
) => {

    try {

        const result =
            await getWithdrawals({

                userId:
                    req.user.id,

                page:
                    req.query.page,

                limit:
                    req.query.limit,

                status:
                    req.query.status
            });


        return res.status(200).json({

            success: true,

            ...result
        });

    } catch (error) {

        next(error);
    }
};


export const getById = async (
    req,
    res,
    next
) => {

    try {

        const withdrawal =
            await getWithdrawal({

                userId:
                    req.user.id,

                withdrawalId:
                    req.params.id
            });


        return res.status(200).json({

            success: true,

            data: withdrawal
        });

    } catch (error) {

        next(error);
    }
};


export const cancel = async (
    req,
    res,
    next
) => {

    try {

        const withdrawal =
            await cancelWithdrawal({

                userId:
                    req.user.id,

                withdrawalId:
                    req.params.id
            });


        return res.status(200).json({

            success: true,

            data: withdrawal
        });

    } catch (error) {

        next(error);
    }
};
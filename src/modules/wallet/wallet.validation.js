export const walletTransactionTypes = [
    "WALLET_TOPUP",
    "ORDER_PAYMENT",
    "WITHDRAWAL_REQUEST",
    "WITHDRAWAL_RESERVED",
    "WITHDRAWAL_PROCESSED",
    "REFUND"
];


export const ledgerStatuses = [
    "PENDING",
    "COMPLETED",
    "FAILED",
    "REVERSED"
];


export const validateStatementFilters = ({
    transactionType,
    status
}) => {

    if (
        transactionType &&
        !walletTransactionTypes.includes(
            transactionType
        )
    ) {

        const error = new Error(
            "Invalid transaction type"
        );

        error.statusCode = 400;

        throw error;
    }


    if (
        status &&
        !ledgerStatuses.includes(status)
    ) {

        const error = new Error(
            "Invalid ledger status"
        );

        error.statusCode = 400;

        throw error;
    }
};
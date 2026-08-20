export const validateCreateWithdrawal = ({
    amount,
    bankAccountId
}) => {

    if (
        amount === undefined ||
        amount === null ||
        amount === ""
    ) {
        throw new Error(
            "Amount is required"
        );
    }


    const numericAmount =
        Number(amount);


    if (
        !Number.isFinite(numericAmount) ||
        numericAmount <= 0
    ) {
        throw new Error(
            "Amount must be greater than zero"
        );
    }


    if (
        !bankAccountId ||
        typeof bankAccountId !== "string"
    ) {
        throw new Error(
            "bankAccountId is required"
        );
    }


    return true;
};
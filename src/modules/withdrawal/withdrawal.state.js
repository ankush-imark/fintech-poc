const allowedTransitions = {

    PENDING: [
        "PROCESSING",
        "CANCELLED"
    ],

    PROCESSING: [
        "COMPLETED",
        "FAILED"
    ],

    COMPLETED: [],

    FAILED: [],

    CANCELLED: []
};


export const canTransition = (
    currentStatus,
    nextStatus
) => {

    return (
        allowedTransitions[
            currentStatus
        ]?.includes(nextStatus) ?? false
    );
};


export const assertTransition = (
    currentStatus,
    nextStatus
) => {

    if (
        !canTransition(
            currentStatus,
            nextStatus
        )
    ) {

        throw new Error(
            `Invalid withdrawal state transition: ${currentStatus} -> ${nextStatus}`
        );
    }
};
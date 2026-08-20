import prisma from "../src/config/prisma.js";

import {
    creditWallet,
    debitWallet
} from "../src/modules/wallet/wallet.transaction.service.js";


const main = async () => {

    const wallet =
        await prisma.wallet.findFirst();

    if (!wallet) {
        throw new Error(
            "No wallet found"
        );
    }

    // const result =
    //     await creditWallet({
    //         walletId: wallet.id,
    //         amount: "1000.00",
    //         transactionType:
    //             "WALLET_TOPUP",
    //         referenceType:
    //             "TOPUP",
    //         referenceId:
    //             "TEST-TOPUP-001",
    //         metadata: {
    //             source: "development-test"
    //         }
    //     });

    const result =
    await debitWallet({
        walletId: wallet.id,
        amount: "13000.00",
        transactionType:
            "ORDER_PAYMENT",
        referenceType:
            "ORDER",
        referenceId:
            "ORDER-TEST-001"
    });
    console.log(
    JSON.stringify(
        result,
        (_, value) => {
            if (value && typeof value === "object") {
                if (value.constructor?.name === "Decimal") {
                    return value.toString();
                }

                if (value instanceof Date) {
                    return value.toISOString();
                }
            }

            return value;
        },
        2
    )
);
};


main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
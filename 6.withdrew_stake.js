const {
  Connection,
  clusterApiUrl,
  LAMPORTS_PER_SOL,
  Keypair,
  StakeProgram,
  Authorized,
  Lockup,
  sendAndConfirmRawTransaction,
  PublicKey,
} = require("@solana/web3.js");

const main = async () => {
  const connection = new Connection(clusterApiUrl("devnet"), "processed");
  const wallet = Keypair.generate();
  const airdropSignatrue = await connection.requestAirdrop(
    wallet.publicKey,
    1 * LAMPORTS_PER_SOL
  );
  await connection.confirmTransaction(airdropSignatrue);
  // const balance = await connection.getBalance(wallet.publicKey)
  // console.log(balance)

  const stakeAccount = Keypair.generate();
  const minimumRent = await connection.getMinimumBalanceForRentExemption(
    StakeProgram.space
  );
  const amountUserWantsToStake = 0.5 * LAMPORTS_PER_SOL;
  const amountToStake = minimumRent + amountUserWantsToStake;

  const createStakeAccountsTx = StakeProgram.createAccount({
    authorized: new Authorized(wallet.publicKey, wallet.publicKey),
    fromPubkey: wallet.publicKey,
    lamports: amountToStake,
    lockup: new Lockup(0, 0, wallet.publicKey),
    stakePubkey: stakeAccount.publicKey,
  });
  const createAccountTxId = await sendAndConfirmRawTransaction(
    connection,
    createStakeAccountsTx,
    [wallet, stakeAccount]
  );

  console.log(`Stake account create TxId ${createAccountTxId}`);
  let stakeBalance = await connection.getBalance(stakeAccount.publicKey);
  console.log(`Stake account balance : ${stakeBalance / LAMPORTS_PER_SOL} Sol`);

  let stakeStatus = await connection.getStakeActivation(stakeAccount.publicKey);
  console.log(`Stake account status : ${stakeStatus.state}`);

  //获取验证者
  const validator = await connection.getVoteAccounts();
  const selectValidator = validator.current[0];
  const selectValidatorPubkey = new PublicKey(selectValidator.votePubkey);

  //授权质押(给验证者)交易
  const delegateTx = StakeProgram.delegate({
    stakePubkey: stakeAccount.publicKey,
    authorizedPubkey: wallet.publicKey,
    votePubkey: selectValidatorPubkey,
  });

  //查询质押交易
  const delegateTxID = await sendAndConfirmRawTransaction(
    connection,
    delegateTx,
    [wallet]
  );
  console.log(
    `Stake account delegated to ${selectValidatorPubkey} . Tx ID:${delegateTxID}`
  );
  stakeStatus = await connection.getStakeActivation(stakeAccount.publicKey);
  console.log(`Stake account status: ${stakeStatus.state}`);

  //取消质押
  const deactiveTx = StakeProgram.deactivate({
    stakePubkey: stakeAccount.publicKey,
    authorizedPubkey: wallet.publicKey,
  });
  const deactiveTxId = await sendAndConfirmRawTransaction(
    connection,
    deactiveTx,
    [wallet]
  );
  console.log(`Stake account Deactived . Tx ID:${deactiveTxId}`);
  stakeStatus = await connection.getStakeActivation(stakeAccount.publicKey);
  console.log(`Stake account status: ${stakeStatus.state}`);

  //质押完成 取回质押的sol
  const withdrewTx = StakeProgram.withdraw({
    stakePubkey: stakeAccount.publicKey, // 质押账户的公钥
    authorizedPubkey: wallet.publicKey, // 授权提取的公钥（一般是质押账户的授权者）
    toPubkey: wallet.publicKey, // 提取SOL的目标账户（一般是钱包账户）
    lamports: stakeBalance, // 提取的 lamports 数量
  });

  const withdrawTxId = await sendAndConfirmRawTransaction(
    connection,
    withdrewTx,
    [wallet]
  );

  console.log(`Stake account withdrew TxId ${withdrawTxId}`);
  stakeBalance = await connection.getBalance(stakeAccount.publicKey);
  console.log(`Stake account balance : ${stakeBalance / LAMPORTS_PER_SOL} Sol`);
};

const runMain = async () => {
  try {
    await main();
  } catch (error) {
    console.error(error);
  }
};

runMain();

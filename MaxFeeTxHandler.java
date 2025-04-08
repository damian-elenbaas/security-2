import java.util.HashMap;
import java.util.ArrayList;
import java.util.Arrays;

public class MaxFeeTxHandler {

    private UTXOPool utxoPool;

    /*
     * Creates a public ledger whose current UTXOPool (collection of unspent
     * transaction outputs) is utxoPool. This should make a defensive copy of
     * utxoPool by using the UTXOPool(UTXOPool uPool) constructor.
     */
    public MaxFeeTxHandler(UTXOPool utxoPool) {
        this.utxoPool = new UTXOPool(utxoPool);
    }

    /*
     * Returns true if
     * (1) all outputs claimed by tx are in the current UTXO pool,
     * (2) the signatures on each input of tx are valid,
     * (3) no utxo is claimed multiple times by tx,
     * (4) all of tx’s output values are non-negative, and
     * (5) the sum of tx’s input values is greater than or equal to the sum of
     * its output values;
     * and false otherwise.
     */

    public boolean isValidTx(Transaction tx) {
        var inputs = tx.getInputs();
        var inputSum = 0.0;
        var inputLinks = new HashMap<Transaction.Input, UTXO>();

        // (1) all outputs claimed by tx are in the current UTXO pool,
        var utxos = this.utxoPool.getAllUTXO();
        for (var input : inputs) {
            var tempUtxo = new UTXO(input.prevTxHash, input.outputIndex);
            for (var utxo : utxos) {
                if (utxo.equals(tempUtxo)) {
                    inputLinks.put(input, utxo);
                    break;
                }
            }
            // No key set, so no linking UTXO found.
            if (!inputLinks.containsKey(input))
                return false;

            var utxo = inputLinks.get(input);
            var prevOutput = this.utxoPool.getTxOutput(utxo);
            inputSum += prevOutput.value;
        }

        // (2) the signatures on each input of tx are valid
        for (var input : inputs) {
            var utxo = inputLinks.get(input);

            var inputIndex = input.outputIndex;
            var output = utxo.getIndex();
            if (inputIndex != output)
                return false;

            var inputTxhash = input.prevTxHash;
            var utxoTxhash = utxo.getTxHash();
            if (!Arrays.equals(inputTxhash, utxoTxhash))
                return false;

            var message = tx.getRawDataToSign(inputs.indexOf(input));
            var publickey = this.utxoPool.getTxOutput(utxo).address;
            boolean isValidSignature = publickey.verifySignature(message, input.signature);
            if (!isValidSignature)
                return false;
        }

        // (3) no utxo is claimed multiple times by tx
        var claimedUtxos = inputLinks.values();
        var uniqueUtxos = claimedUtxos.stream().distinct().toList();
        if (claimedUtxos.size() != uniqueUtxos.size())
            return false;

        // (4) all of tx’s output values are non-negative, and
        var outputs = tx.getOutputs();
        var outputSum = 0.0;
        for (var output : outputs) {
            var value = output.value;
            if (value < 0)
                return false;
            outputSum += value;
        }

        // (5) the sum of tx’s input values is greater than or equal to the sum of
        // its output values;
        // and false otherwise.
        return !(inputSum < outputSum);
    }

    /*
     * Handles each epoch by receiving an unordered array of proposed
     * transactions, checking each transaction for correctness,
     * returning a mutually valid array of accepted transactions,
     * and updating the current UTXO pool as appropriate.
     * 
     * Create a second file called MaxFeeTxHandler.java with similar API whose handleTxs finds
     * a set of transactions with maximum total transaction fees (i.e. maximize the sum over all transactions
     * in the set of (sum of input values - sum of output values)). Finding such a set of transactions is NP hard
     * and thus find only a heuristic which might increase the total transaction fees
     */
    public Transaction[] handleTxs(Transaction[] possibleTxs) {
        // Best way would be to find the best order of the set of transactions with maximum fees.
        // However that requires to calculate each fee in each possible order of possibleTxs

        // Therefor we implement a simpler approach of simply sorting the transactions by their fees
        // and then adding them to the accepted transactions if they are valid.
        possibleTxs = Arrays.stream(possibleTxs)
                .sorted((tx1, tx2) -> Double.compare(calculateFee(tx2), calculateFee(tx1)))
                .toArray(Transaction[]::new);
        // Now we have the transactions sorted by their fees, we can add them to the accepted transactions
        var acceptedTxs = new ArrayList<Transaction>();
        for (var tx : possibleTxs) {
            if (isValidTx(tx)) {
                acceptedTxs.add(tx);
                var inputs = tx.getInputs();
                for (var input : inputs) {
                    var utxo = new UTXO(input.prevTxHash, input.outputIndex);
                    this.utxoPool.removeUTXO(utxo);
                }
                var outputs = tx.getOutputs();
                var index = 0;
                for (var output : outputs) {
                    var utxo = new UTXO(tx.getHash(), index);
                    this.utxoPool.addUTXO(utxo, output);
                    index += 1;
                }
            }
        }
        return acceptedTxs.toArray(new Transaction[0]);
    }

    public double calculateFee(Transaction tx) {
        var inputs = tx.getInputs();
        var inputSum = 0.0;
        for (var input : inputs) {
            var utxo = new UTXO(input.prevTxHash, input.outputIndex);
            var prevOutput = this.utxoPool.getTxOutput(utxo);
            inputSum += prevOutput.value;
        }

        var outputs = tx.getOutputs();
        var outputSum = 0.0;
        for (var output : outputs) {
            var value = output.value;
            outputSum += value;
        }

        return (inputSum - outputSum);
    }

}

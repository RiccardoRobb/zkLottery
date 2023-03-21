import {
    AccountUpdate,
    Poseidon,
    Field,
    method,
    PublicKey,
    SmartContract,
    state,
    State,
    UInt64
} from  "snarkyjs";

const MINA = 1e9;

export class Lottery extends SmartContract {
    @state(PublicKey) owner = State<PublicKey>();
    @state(UInt64) value = State<UInt64>();
    @state(UInt64) ticketCost = State<UInt64>();
    @state(UInt64) prize = State<UInt64>();

    @state(Field) winner = State<Field>();

    init() {
        super.init();
        this.owner.set(PublicKey.empty());
        this.winner.set(Field(1));
    }

    active() {
        this.owner.get().isEmpty().assertFalse("No existing lottery!");
        this.owner.assertEquals(this.owner.get());
    }

    @method createLottery(ticketCost: UInt64, prize: UInt64) {
        this.owner.assertEquals(PublicKey.empty());
        this.owner.set(this.sender);

        ticketCost.assertGreaterThan(UInt64.zero, "Invalid argument: ticketCost!");
        prize.assertGreaterThan(UInt64.zero, "Invalid argument: prize!");

        const _ticketCost = this.ticketCost.get();
        this.ticketCost.assertEquals(this.ticketCost.get());

        _ticketCost.assertLessThan(UInt64.one, "Lottery already finished!")

        /* const ownerUpdate = AccountUpdate.createSigned(this.sender);

        const balance = ownerUpdate.account.balance.get()
        ownerUpdate.account.balance.assertEquals(ownerUpdate.account.balance.get());

        balance.assertGreaterThanOrEqual(prize, "You don't have enough money!");

        ownerUpdate.send({
            to: this,
            amount: prize
        }); */

        this.ticketCost.set(ticketCost);
        this.prize.set(prize);
    }

    @method buyTicket() {
        this.active();

        const payerUpdate = AccountUpdate.createSigned(this.sender);

        const balance = payerUpdate.account.balance.get()
        payerUpdate.account.balance.assertEquals(payerUpdate.account.balance.get());

        const payment = this.ticketCost.get();
        this.ticketCost.assertEquals(this.ticketCost.get());

        balance.assertGreaterThanOrEqual(payment, "You don't have enough money!");

        payerUpdate.send({
            to: this,
            amount: payment
        });

        const _value = this.value.get().add(1);
        this.value.assertEquals(this.value.get());

        this.value.set(_value);

        return Poseidon.hash([ this.address.x, _value.value ]);
    }

    @method closeLottery() {
        this.active();
        this.owner.assertEquals(this.sender);

        const winner = Field.random();

        if (winner.lessThan(0))
            winner.neg();

        const _winner = UInt64.fromFields(winner.toFields()).mod(this.value.get());
        this.value.assertEquals(this.value.get());

        this.value.set(_winner.add(1));
        this.owner.set(PublicKey.empty());


        this.ticketCost.set(UInt64.one);

        this.winner.set(Poseidon.hash([ this.address.x, this.value.get().value ]));
        this.value.assertEquals(this.value.get());
    }

    @method verifyWinner(ticket: Field) {
        this.prize.get().assertGreaterThan(UInt64.zero, "Lottery prize alredy claimed!");
        this.prize.assertEquals(this.prize.get());
        
        this.winner.assertEquals(ticket);

        const _amount = this.prize.get();
        this.prize.assertEquals(this.prize.get());

        this.send({
            to: this.sender,
            amount: _amount
        });

        this.prize.set(UInt64.zero);
    }

}
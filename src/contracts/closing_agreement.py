from pyteal import *

"""
Closing Agreement Smart Contract with Milestones

Purpose: Handle a closing agreement with defined milestones and signature verification.
"""

def approval_program():
    # Global state variables
    admin = Bytes("admin")  # Admin who can manage the application
    
    # Agreement state variables (global state)
    buyer = Bytes("buyer")
    seller = Bytes("seller")
    amount = Bytes("amount")
    document_hash = Bytes("document_hash")
    status = Bytes("status")  # DRAFT, PENDING, EXECUTED, CANCELLED
    execution_date = Bytes("execution_date")
    
    # Signature tracking
    buyer_signed = Bytes("buyer_signed")
    seller_signed = Bytes("seller_signed")
    
    # Milestone tracking
    milestone_count = Bytes("milestone_count")
    current_milestone = Bytes("current_milestone")
    
    # Define application arguments indices
    ACTION = Txn.application_args[0]
    
    # Actions
    INITIALIZE = Bytes("initialize")
    ADD_MILESTONE = Bytes("add_milestone")
    COMPLETE_MILESTONE = Bytes("complete_milestone")
    VERIFY_SIGNATURE = Bytes("verify_signature")
    EXECUTE_AGREEMENT = Bytes("execute_agreement")
    CANCEL_AGREEMENT = Bytes("cancel_agreement")
    
    # Status values
    STATUS_DRAFT = Bytes("DRAFT")
    STATUS_PENDING = Bytes("PENDING")
    STATUS_EXECUTED = Bytes("EXECUTED")
    STATUS_CANCELLED = Bytes("CANCELLED")
    
    # Handle initialization
    on_creation = Seq([
        App.globalPut(admin, Txn.sender()),
        App.globalPut(status, STATUS_DRAFT),
        App.globalPut(milestone_count, Int(0)),
        App.globalPut(current_milestone, Int(0)),
        App.globalPut(buyer_signed, Int(0)),
        App.globalPut(seller_signed, Int(0)),
        
        # Log initialization
        Log(Bytes("INIT:admin=")),
        Log(Txn.sender()),
        Return(Int(1))
    ])
    
    # ===== Helper Functions =====
    
    # Check if caller is admin
    is_admin = Txn.sender() == App.globalGet(admin)
    
    # Check if caller is buyer
    is_buyer = Txn.sender() == App.globalGet(buyer)
    
    # Check if caller is seller
    is_seller = Txn.sender() == App.globalGet(seller)
    
    # Check if agreement is in draft status
    is_draft = App.globalGet(status) == STATUS_DRAFT
    
    # Check if agreement is in pending status
    is_pending = App.globalGet(status) == STATUS_PENDING
    
    # Check if agreement is executed
    is_executed = App.globalGet(status) == STATUS_EXECUTED
    
    # Check if agreement is cancelled
    is_cancelled = App.globalGet(status) == STATUS_CANCELLED
    
    # Check if all parties have signed
    all_signed = And(
        App.globalGet(buyer_signed) == Int(1),
        App.globalGet(seller_signed) == Int(1)
    )
    
    # Check if all milestones are complete
    all_milestones_complete = App.globalGet(current_milestone) == App.globalGet(milestone_count)
    
    # ===== Action Logic =====
    
    # Initialize the agreement
    # Args: buyer (address), seller (address), amount (uint64), doc_hash (bytes32)
    on_initialize = Seq([
        Assert(Txn.application_args.length() == Int(5)),
        Assert(is_admin),  # Only admin can initialize
        Assert(is_draft),  # Only initialize if in DRAFT status
        
        # Store basic agreement data
        App.globalPut(buyer, Txn.application_args[1]),
        App.globalPut(seller, Txn.application_args[2]),
        App.globalPut(amount, Btoi(Txn.application_args[3])),
        App.globalPut(document_hash, Txn.application_args[4]),
        
        # Set status to PENDING
        App.globalPut(status, STATUS_PENDING),
        
        # Log initialization
        Log(Bytes("AGREEMENT_INITIALIZED")),
        Log(Concat(Bytes("BUYER:"), Txn.application_args[1])),
        Log(Concat(Bytes("SELLER:"), Txn.application_args[2])),
        
        Return(Int(1))
    ])
    
    # Add a milestone
    # Args: milestone_title (string), milestone_description (string)
    on_add_milestone = Seq([
        Assert(Txn.application_args.length() == Int(3)),
        Assert(Or(is_admin, is_buyer, is_seller)),  # Admin or parties can add milestones
        Assert(is_draft.Or(is_pending)),  # Only add milestones in DRAFT or PENDING
        
        # Get the next milestone index
        App.localPut(Int(0), Bytes("next_index"), App.globalGet(milestone_count)),
        
        # Store milestone data
        App.globalPut(
            Concat(Bytes("milestone_"), Itob(App.localGet(Int(0), Bytes("next_index")))),
            Concat(
                Txn.application_args[1],  # Title
                Bytes("|"),
                Txn.application_args[2],  # Description
                Bytes("|"),
                Bytes("0")  # 0 = not completed
            )
        ),
        
        # Increment milestone count
        App.globalPut(milestone_count, App.globalGet(milestone_count) + Int(1)),
        
        # Log milestone addition
        Log(Bytes("MILESTONE_ADDED")),
        Log(Concat(Bytes("INDEX:"), Itob(App.localGet(Int(0), Bytes("next_index"))))),
        Log(Concat(Bytes("TITLE:"), Txn.application_args[1])),
        
        Return(Int(1))
    ])
    
    # Complete a milestone
    # Args: milestone_index (uint64)
    on_complete_milestone = Seq([
        Assert(Txn.application_args.length() == Int(2)),
        Assert(Or(is_admin, is_buyer, is_seller)),  # Admin or parties can complete milestones
        Assert(is_pending),  # Only complete milestones when PENDING
        
        # Get milestone index
        App.localPut(Int(0), Bytes("index"), Btoi(Txn.application_args[1])),
        
        # Check if milestone exists
        Assert(App.localGet(Int(0), Bytes("index")) < App.globalGet(milestone_count)),
        
        # Check if milestone is next in sequence
        Assert(App.localGet(Int(0), Bytes("index")) == App.globalGet(current_milestone)),
        
        # Get milestone data
        App.localPut(
            Int(0), 
            Bytes("milestone_data"), 
            App.globalGet(Concat(Bytes("milestone_"), Txn.application_args[1]))
        ),
        
        # Check last character to ensure milestone is not already completed
        Assert(
            Substring(
                App.localGet(Int(0), Bytes("milestone_data")),
                Len(App.localGet(Int(0), Bytes("milestone_data"))) - Int(1),
                Len(App.localGet(Int(0), Bytes("milestone_data")))
            ) == Bytes("0")
        ),
        
        # Update milestone data (mark as completed)
        App.globalPut(
            Concat(Bytes("milestone_"), Txn.application_args[1]),
            Concat(
                Substring(
                    App.localGet(Int(0), Bytes("milestone_data")),
                    Int(0),
                    Len(App.localGet(Int(0), Bytes("milestone_data"))) - Int(1)
                ),
                Bytes("1")  # 1 = completed
            )
        ),
        
        # Update milestone completion timestamp
        App.globalPut(
            Concat(Bytes("milestone_completed_"), Txn.application_args[1]),
            Itob(Global.latest_timestamp())
        ),
        
        # Increment current milestone
        App.globalPut(current_milestone, App.globalGet(current_milestone) + Int(1)),
        
        # Log milestone completion
        Log(Bytes("MILESTONE_COMPLETED")),
        Log(Concat(Bytes("INDEX:"), Txn.application_args[1])),
        Log(Concat(Bytes("TIMESTAMP:"), Itob(Global.latest_timestamp()))),
        
        Return(Int(1))
    ])
    
    # Verify signature for a party
    # Args: party (address)
    on_verify_signature = Seq([
        Assert(Txn.application_args.length() == Int(2)),
        Assert(Or(is_admin, is_buyer, is_seller)),  # Admin or parties can verify signatures
        Assert(is_pending),  # Only verify signatures when PENDING
        
        # Check which party is signing
        If(
            Txn.application_args[1] == App.globalGet(buyer),
            # Buyer signing
            Seq([
                App.globalPut(buyer_signed, Int(1)),
                App.globalPut(Bytes("buyer_signed_at"), Global.latest_timestamp()),
                Log(Bytes("BUYER_SIGNATURE_VERIFIED"))
            ]),
            # Seller signing
            If(
                Txn.application_args[1] == App.globalGet(seller),
                Seq([
                    App.globalPut(seller_signed, Int(1)),
                    App.globalPut(Bytes("seller_signed_at"), Global.latest_timestamp()),
                    Log(Bytes("SELLER_SIGNATURE_VERIFIED"))
                ]),
                # Invalid party
                Err()
            )
        ),
        
        # Check if both have signed and all milestones complete for auto-execution
        If(
            And(
                all_signed,
                all_milestones_complete
            ),
            # Auto-execute agreement
            Seq([
                App.globalPut(status, STATUS_EXECUTED),
                App.globalPut(execution_date, Global.latest_timestamp()),
                Log(Bytes("AGREEMENT_AUTO_EXECUTED")),
                Log(Concat(Bytes("TIMESTAMP:"), Itob(Global.latest_timestamp())))
            ])
        ),
        
        Return(Int(1))
    ])
    
    # Manually execute agreement
    # Args: none
    on_execute_agreement = Seq([
        Assert(Txn.application_args.length() == Int(1)),
        Assert(Or(is_admin, is_buyer, is_seller)),  # Admin or parties can execute
        Assert(is_pending),  # Only execute when PENDING
        
        # Verify all signatures and milestones are complete
        Assert(all_signed),
        Assert(all_milestones_complete),
        
        # Execute agreement
        App.globalPut(status, STATUS_EXECUTED),
        App.globalPut(execution_date, Global.latest_timestamp()),
        
        # Log execution
        Log(Bytes("AGREEMENT_EXECUTED")),
        Log(Concat(Bytes("TIMESTAMP:"), Itob(Global.latest_timestamp()))),
        
        Return(Int(1))
    ])
    
    # Cancel agreement
    # Args: none
    on_cancel_agreement = Seq([
        Assert(Txn.application_args.length() == Int(1)),
        Assert(Or(is_admin, is_buyer, is_seller)),  # Admin or parties can cancel
        Assert(Not(is_executed)),  # Cannot cancel if already executed
        Assert(Not(is_cancelled)),  # Cannot cancel if already cancelled
        
        # Cancel agreement
        App.globalPut(status, STATUS_CANCELLED),
        
        # Log cancellation
        Log(Bytes("AGREEMENT_CANCELLED")),
        Log(Concat(Bytes("BY:"), Txn.sender())),
        Log(Concat(Bytes("TIMESTAMP:"), Itob(Global.latest_timestamp()))),
        
        Return(Int(1))
    ])
    
    # Main router logic
    program = Cond(
        [Txn.application_id() == Int(0), on_creation],
        [ACTION == INITIALIZE, on_initialize],
        [ACTION == ADD_MILESTONE, on_add_milestone],
        [ACTION == COMPLETE_MILESTONE, on_complete_milestone],
        [ACTION == VERIFY_SIGNATURE, on_verify_signature],
        [ACTION == EXECUTE_AGREEMENT, on_execute_agreement],
        [ACTION == CANCEL_AGREEMENT, on_cancel_agreement]
    )
    
    return program

def clear_state_program():
    return Return(Int(1))

if __name__ == "__main__":
    with open("closing_agreement_approval.teal", "w") as f:
        compiled = compileTeal(approval_program(), mode=Mode.Application, version=6)
        f.write(compiled)
        
    with open("closing_agreement_clear_state.teal", "w") as f:
        compiled = compileTeal(clear_state_program(), mode=Mode.Application, version=6)
        f.write(compiled)
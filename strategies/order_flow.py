import os
from utils.hyperliquid_client import HyperliquidTestnet

async def get_obi_signal(coin="BTC"):
    """
    Calculates Order Book Imbalance (OBI) from L2 Snapshot.
    OBI = (Bid Volume - Ask Volume) / (Bid Volume + Ask Volume)
    Values > 0 indicate buy pressure, < 0 indicate sell pressure.
    """
    client = HyperliquidTestnet()
    snapshot = await client.get_l2_snapshot(coin)

    if not snapshot or 'levels' not in snapshot:
        return 0.0

    # Hyperliquid levels: [ [bid_price, bid_sz], ... ], [ [ask_price, ask_sz], ... ]
    # snapshot['levels'][0] is bids, snapshot['levels'][1] is asks
    bids = snapshot['levels'][0]
    asks = snapshot['levels'][1]

    # Sum volume for top 5 levels
    bid_vol = sum(float(l['sz']) for l in bids[:5])
    ask_vol = sum(float(l['sz']) for l in asks[:5])

    if (bid_vol + ask_vol) == 0:
        return 0.0

    obi = (bid_vol - ask_vol) / (bid_vol + ask_vol)
    return obi

async def order_flow_signal(coin="BTC"):
    """
    Returns an order flow signal based on OBI.
    """
    obi = await get_obi_signal(coin)

    # Thresholds: |OBI| > 0.3 is significant
    if obi > 0.3:
        return {"action": "long", "conviction": obi}
    elif obi < -0.3:
        return {"action": "short", "conviction": abs(obi)}

    return {"action": "hold", "conviction": 0.0}

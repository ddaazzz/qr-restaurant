/*import {Router} from "express";
import pool from "../config/db";

const router = Router();

router.get("/scan/:token", async (req, res)  => {
    const {token} = req.params;

    const result = await pool.query(
        "SELECT * FROM restaurants WHERE qr_token = $1", 
        [token]
    );
    if (result.rowsCount === 0){
        return res.status(404).json({message: 'no QR code found'});
    }

        const table = result.rows[0];
        res.json ({
            message: 'QR code successful',
            table_id: table.id,
            restaurant_id: table.restaurant_id,

});
    });
export default router;
*/
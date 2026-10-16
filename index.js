var express = require('express')

var ejs= require('ejs')

var app = express();

var bodyParser = require('body-parser');
var mysql = require('mysql');
var session = require('express-session');



app.use(express.static('public'));
app.set('view engine', 'ejs');

app.listen(8080);
app.use(bodyParser.urlencoded({extended:true}))
app.use(session({
    secret: "secret",
    resave: false,
    saveUninitialized: true
}));



function isProductInCart(cart,id){
for(let i=0;i<cart.length;i++){
    if(cart[i].id==id){
        return true;
    }
}
return false;
}

function calculateTotal(cart, req){
   let total=0;

    for(let i=0;i<cart.length;i++){
        //if we're offering a discounted price
        if(cart[i].sale_price){
            total=total+(cart[i].sale_price*cart[i].quantity);
        }
        else{
            total =total +(cart[i].price*cart[i].quantity)
        }
    }
    req.session.total=total;
    return total;
}


app.get('/cart', function(req, res) {

    var cart = req.session.cart || [];
    var total = req.session.total || 0;

    console.log("CART:", cart);
    console.log("TOTAL:", total);

    res.render('pages/cart', {
        cart: cart,
        total: total
    });
});

app.get('/',function(req,res){


var con= mysql.createConnection({
    host:"localhost",
    user:"root",
    password:"",
    database:"node_project"
})

con.query("SELECT * FROM products",(err,result)=>{
     res.render('pages/index',{result:result});
})

   

});


app.post('/remove_product', function(req, res) {

    var id = req.body.id;

    var cart = req.session.cart || [];

    for (let i = 0; i < cart.length; i++) {

        if (cart[i].id == id) {
            cart.splice(i, 1);
            break;
        }
    }

    calculateTotal(cart, req);

    req.session.cart = cart;

    res.redirect('/cart');
});

app.post('/add_to_cart' ,function(req,res){
var id= req.body.id;
var name= req.body.name;
var price= req.body.price;
var sale_price= req.body.sale_price;
var quantity= req.body.quantity;
var image= req.body.image;
var product={id:id,name:name,price:price,sale_price:sale_price,quantity:quantity,image:image};

if(req.session.cart){

    var cart = req.session.cart;
    if(!isProductInCart(cart,id)){
        cart.push(product);
    }

}else{
    req.session.cart=[product];
    var cart =req.session.cart;
}




//calculate total 
calculateTotal(cart,req);

//return to cart page
res.redirect('/cart');


});


app.post('/edit_product_quantity', function(req, res) {

   console.log("BODY:", req.body);

    var id = req.body.id;

    var increase_btn = req.body.increase_product_quantity_btn;
    var decrease_btn = req.body.decrease_product_quantity_btn;

    console.log("ID:", id);
    console.log("INCREASE:", increase_btn);
    console.log("DECREASE:", decrease_btn);

    var cart = req.session.cart || [];

    // Increase quantity
    if (increase_btn) {

        for (let i = 0; i < cart.length; i++) {

            if (cart[i].id == id) {

                cart[i].quantity = parseInt(cart[i].quantity) + 1;

                break;
            }
        }
    }

    // Decrease quantity
    if (decrease_btn) {

        for (let i = 0; i < cart.length; i++) {

            if (cart[i].id == id) {

                if (parseInt(cart[i].quantity) > 1) {
                    cart[i].quantity = parseInt(cart[i].quantity) - 1;
                }

                break;
            }
        }
    }

    // Recalculate total
    calculateTotal(cart, req);

    // Go back to cart
    res.redirect('/cart');
});

app.get('/checkout' , function(req,res){

    var total = req.session.total;
    res.render('pages/checkout',{total:total})
})

app.post('/post_order', function(req, res) {

    console.log("=================================");
    console.log("POST ORDER ROUTE CALLED");
    console.log("=================================");

    console.log("FORM DATA:", req.body);
    console.log("CART:", req.session.cart);
    console.log("TOTAL:", req.session.total);

    // Generate custom Order ID using timestamp
    var id = Date.now();

    // Customer details
    var name = req.body.name;
    var email = req.body.email;
    var phone = req.body.phone;
    var city = req.body.city;
    var address = req.body.address;

    // Cart and total
    var cost = req.session.total;
    var cart = req.session.cart || [];

    var status = "not paid";
    var date = new Date();
    
    // Save order ID into session
    req.session.order_id = id;

    // Check cart
    if (cart.length === 0) {

        console.log("ERROR: CART IS EMPTY");

        return res.redirect('/cart');
    }

    // Check customer data
    console.log("NAME:", name);
    console.log("EMAIL:", email);
    console.log("PHONE:", phone);
    console.log("CITY:", city);
    console.log("ADDRESS:", address);
    console.log("COST:", cost);


    // Create database connection
    var con = mysql.createConnection({
        host: "localhost",
        user: "root",
        password: "",
        database: "node_project"
    });


    // Connect database
    con.connect(function(err) {

        if (err) {

            console.log("DATABASE CONNECTION ERROR:");
            console.log(err);

            return res.status(500).send(err.message);
        }

        console.log("DATABASE CONNECTED SUCCESSFULLY");


        // ==========================================
        // INSERT INTO ORDERS
        // ==========================================

        var orderQuery = `
            INSERT INTO orders
            (
                id,
                cost,
                name,
                email,
                status,
                city,
                address,
                phone,
                date
            )
            VALUES ?
        `;


        var orderValues = [[
            id,
            cost,
            name,
            email,
            status,
            city,
            address,
            phone,
            date
        ]];


        console.log("INSERTING ORDER...");


        con.query(orderQuery, [orderValues], function(err, result) {

            if (err) {

                console.log("=================================");
                console.log("ORDER INSERT ERROR");
                console.log("=================================");

                console.log(err);
                console.log("MYSQL ERROR:", err.sqlMessage);

                con.end();

                return res.status(500).send(err.sqlMessage);
            }


            console.log("ORDER INSERTED SUCCESSFULLY");


            // ==========================================
            // INSERT INTO ORDER_ITEMS
            // ==========================================

            var itemQuery = `
                INSERT INTO order_items
                (
                    order_id,
                    product_id,
                    product_name,
                    product_price,
                    product_image,
                    product_quantity,
                    order_date
                )
                VALUES ?
            `;


            var itemValues = [];


            for (let i = 0; i < cart.length; i++) {

                itemValues.push([
                    id,
                    cart[i].id,
                    cart[i].name,
                    cart[i].price,
                    cart[i].image,
                    cart[i].quantity,
                    new Date()
                ]);

            }


            console.log("ORDER ITEMS:");
            console.log(itemValues);


            // Insert order items
            con.query(itemQuery, [itemValues], function(err, result) {

                if (err) {

                    console.log("=================================");
                    console.log("ORDER ITEMS INSERT ERROR");
                    console.log("=================================");

                    console.log(err);
                    console.log("MYSQL ERROR:", err.sqlMessage);

                    con.end();

                    return res.status(500).send(err.sqlMessage);
                }


                console.log("ORDER ITEMS INSERTED SUCCESSFULLY");


                // Close connection
                con.end();


                // Go to payment
                res.redirect('/payment');

            });

        });

    });

});

app.get('/payment', function(req, res) {

    var total = req.session.total || 0;

    res.render('pages/payment', {
        total: total
    });

});


app.get("/verify_payment", function(req, res) {
    var transaction_id = req.query.transaction_id;
    var order_id = req.session.order_id;


    var con=mysql.createConnection({
        host:"localhost",
        user:"root",
        password:"",
        database:"node_project"
    })

    con.connect((err)=>{
        if(err){
            console.log(err)
        }
        else{
            var query="INSERT INTO payments (order_id,transaction_id,date) VALUES ?";
            var valuess =[
                [order_id,transaction_id,new Date()]
            ]
            con.query(query,[valuess],(err,result )=>{
con.query("UPDATE orders SET status ='paid' WHERE id='"+order_id+"'",(err,result)=>{

})
res.redirect('/thank_you')
            })
        }
    })
});

app.get("/thank_you", function(req, res) {

    var order_id = req.session.order_id;

    res.render("pages/thank_you", {
        order_id: order_id
    });

});

app.get("/single_product", function(req, res) {

    var id = req.query.id;

    var con = mysql.createConnection({
        host: "localhost",
        user: "root",
        password: "",
        database: "node_project"
    });

    var query = "SELECT * FROM products WHERE id = ?";

    con.query(query, [id], function(err, result) {

        if (err) {
            console.log("SINGLE PRODUCT ERROR:", err);
            return res.status(500).send(err.message);
        }

        if (result.length === 0) {
            return res.status(404).send("Product not found");
        }

        res.render("pages/single_product", {
            result: result
        });

        con.end();

    });

});

app.get("/products",function(req,res){

    var con=mysql.createConnection({
        host:"localhost",
        user:"root",
        password:"",
        database:"node_project"
    })

    con.query("SELECT * FROM products" ,(err,result)=>{
        res.render("pages/products",{result:result});
    })

});

app.get("/about",function(req,res){
res.render("pages/about")
});

